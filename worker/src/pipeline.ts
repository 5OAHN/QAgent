import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { chromium } from "playwright";
import { UIDictionary } from "./parser";
import { runTest, TestResult } from "./executor";
import { analyzeFailure } from "./analyzer";
import { runVisionAgent } from "./vision-agent";

export interface RunResult {
  runId: string;
  status: "running" | "completed" | "failed";
  paused?: boolean;
  total: number;
  passed: number;
  failed: number;
  cases: TestResult[];
  createdAt: string;
  mode: "excel" | "natural";
  targetUrl?: string;
  scenarios?: string;
  executor?: string;
  error?: string;
}

export function getAllRuns(): RunResult[] {
  return Array.from(activeRuns.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

const activeRuns = new Map<string, RunResult>();
const cancelledRuns = new Set<string>();
const pausedRuns = new Set<string>();

export function getRunResult(runId: string): RunResult | undefined {
  return activeRuns.get(runId);
}

export function cancelRun(runId: string): boolean {
  const run = activeRuns.get(runId);
  if (!run || run.status !== "running") return false;
  cancelledRuns.add(runId);
  return true;
}

export function pauseRun(runId: string): boolean {
  const run = activeRuns.get(runId);
  if (!run || run.status !== "running") return false;
  pausedRuns.add(runId);
  run.paused = true;
  return true;
}

export function resumeRun(runId: string): boolean {
  const run = activeRuns.get(runId);
  if (!run) return false;
  pausedRuns.delete(runId);
  run.paused = false;
  return true;
}

// ── 공통: 테스트 케이스 실행 루프 ──────────────────────────────────────
async function executeTestCases(
  run: RunResult,
  testCases: any[],
  dictionary: UIDictionary
): Promise<void> {
  let storageState: any;
  for (const tc of testCases) {
    console.log(`\n[${tc.testId}] ${tc.scenario}`);
    const { result, storageState: nextState } = await runTest(tc, dictionary, storageState);
    storageState = nextState ?? storageState;
    if (result.status === "Fail") {
      result.failReason = await analyzeFailure(tc, result);
    }
    run.cases.push(result);
    result.status === "Pass" ? run.passed++ : run.failed++;
  }
}

// ── 엑셀 파이프라인 ───────────────────────────────────────────────────
export async function runExcelPipeline(
  runId: string,
  excelPath: string,
  targetUrl?: string,
  executor?: string
): Promise<RunResult> {
  const dictionary = new UIDictionary(path.resolve("ui_dictionary.yaml"));

  if (targetUrl) {
    (dictionary as any).pages["대상URL"] = { url: targetUrl };
    (dictionary as any).pages["대상 URL"] = { url: targetUrl };
  }

  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });

  const testCases = rows.slice(1)
    .filter((row) => row[1])
    .map((row) => ({
      testId: String(row[1]),
      feature: String(row[2] || ""),
      scenario: String(row[3] || ""),
      precondition: String(row[4] || ""),
      actions: String(row[5] || ""),
      expected: String(row[6] || ""),
    }));

  const run: RunResult = {
    runId, status: "running", mode: "excel",
    total: testCases.length, passed: 0, failed: 0,
    cases: [], createdAt: new Date().toISOString(),
    executor,
  };
  activeRuns.set(runId, run);

  try {
    await executeTestCases(run, testCases, dictionary);
    run.status = "completed";
    console.log(`\n✅ 완료 — Pass: ${run.passed} / Fail: ${run.failed}`);
  } catch (err: any) {
    run.status = "failed";
    run.error = err.message;
  }

  return run;
}

// ── 자연어 파이프라인 (Vision 에이전트) ──────────────────────────────
export async function runNaturalLanguagePipeline(
  runId: string,
  targetUrl: string,
  scenarioList: string[],
  executor?: string
): Promise<RunResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    const run: RunResult = {
      runId, status: "failed", mode: "natural",
      total: 0, passed: 0, failed: 0, cases: [],
      createdAt: new Date().toISOString(),
      error: "ANTHROPIC_API_KEY가 필요합니다.",
    };
    activeRuns.set(runId, run);
    return run;
  }

  const run: RunResult = {
    runId, status: "running", mode: "natural",
    total: scenarioList.length, passed: 0, failed: 0, cases: [],
    createdAt: new Date().toISOString(),
    targetUrl,
    scenarios: scenarioList.join("\n\n---\n\n"),
    executor,
  };
  activeRuns.set(runId, run);

  const screenshotDir = path.resolve("data/screenshots");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const BASE_URL = process.env.WORKER_BASE_URL || "http://localhost:8001";
  void BASE_URL; // 실패 스크린샷 URL에서만 사용

  const control = {
    isCancelled: () => cancelledRuns.has(runId),
    isPaused: () => pausedRuns.has(runId),
  };

  // 케이스별 순차 실행
  let sharedStorageState: any;
  let sharedCurrentUrl: string | undefined;
  for (let i = 0; i < scenarioList.length; i++) {
    // 케이스 시작 전 중지 확인
    if (control.isCancelled()) {
      console.log(`\n🛑 [${runId}] 중지됨 — 남은 케이스 건너뜀`);
      break;
    }
    const naturalText = scenarioList[i];
    const testId = `V-${String(i + 1).padStart(3, "0")}`;

    const result: TestResult = {
      testId,
      feature: "Vision 에이전트",
      scenario: naturalText.slice(0, 80),
      status: "Pending",
      failReason: "",
      videoUrl: "",
      screenshotUrl: "",
      consoleLogs: [],
    };

    // 실행 전 Pending 상태로 먼저 노출
    run.cases = [...run.cases.filter((c) => c.testId !== testId), result];

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      ...(sharedStorageState ? { storageState: sharedStorageState } : {}),
    });
    const page = await context.newPage();

    try {
      const startUrl = sharedCurrentUrl ?? targetUrl;
      console.log(`\n🤖 [${testId}] Vision 에이전트 시작 → ${startUrl}`);
      await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

      const liveStepLogs: string[] = [];

      const visionResult = await runVisionAgent(page, naturalText, 20, (step) => {
        const icon = step.action === "done" ? "✅" : step.action === "failed" ? "❌" : `[${step.stepNum}]`;
        liveStepLogs.push(`${icon} ${step.action.toUpperCase()} ${step.details}\n    💭 ${step.thought}`);
        result.consoleLogs = [...liveStepLogs];
        run.cases = run.cases.map((c) => c.testId === testId ? { ...result } : c);
      }, control);

      result.consoleLogs = visionResult.steps.map((s) => {
        const icon = s.action === "done" ? "✅" : s.action === "failed" ? "❌" : `[${s.stepNum}]`;
        return `${icon} ${s.action.toUpperCase()} ${s.details}\n    💭 ${s.thought}`;
      });

      if (visionResult.success) {
        result.status = "Pass";
        if (visionResult.summary) result.consoleLogs.push(`✅ ${visionResult.summary}`);
        sharedStorageState = await context.storageState();
        sharedCurrentUrl = page.url();
        run.passed++;
        console.log(`\n✅ [${testId}] 완료`);
      } else {
        result.status = "Fail";
        result.failReason = visionResult.failReason || "알 수 없는 오류";
        const shotPath = path.join(screenshotDir, `${runId}_${testId}_fail.png`);
        await page.screenshot({ path: shotPath, fullPage: true });
        result.screenshotUrl = `${BASE_URL}/data/screenshots/${runId}_${testId}_fail.png`;
        run.failed++;
        console.log(`\n❌ [${testId}] 실패: ${result.failReason}`);
      }

    } catch (err: any) {
      result.status = "Fail";
      result.failReason = err.message;
      run.failed++;
      console.error(`\n❌ [${testId}] 오류:`, err.message);
    } finally {
      await context.close();
      await browser.close();

      // 최종 결과 반영
      run.cases = run.cases.map((c) => c.testId === testId ? { ...result } : c);
    }
  }

  cancelledRuns.delete(runId);
  pausedRuns.delete(runId);
  run.paused = false;
  run.status = run.total > 0 && run.failed === run.total ? "failed" : "completed";
  return run;
}
