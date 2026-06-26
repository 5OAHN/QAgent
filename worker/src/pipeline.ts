import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { chromium } from "playwright";
import { UIDictionary } from "./parser";
import { runTest, TestResult } from "./executor";
import { analyzeFailure } from "./analyzer";
import { runVisionAgent } from "./vision-agent";
import { saveRun, loadAllRuns, deleteRun } from "./db";

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

// 디스크(JSON 파일)에 저장된 과거 이력을 메모리로 복원 — 재배포 후에도 이력 유지
for (const run of loadAllRuns()) {
  activeRuns.set(run.runId, run);
}

export function getRunResult(runId: string): RunResult | undefined {
  return activeRuns.get(runId);
}

export function deleteRunResult(runId: string): boolean {
  const run = activeRuns.get(runId);
  if (run && run.status === "running") return false; // 실행 중인 런은 삭제 불가
  activeRuns.delete(runId);
  return deleteRun(runId);
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
    saveRun(run);
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
  saveRun(run);

  try {
    await executeTestCases(run, testCases, dictionary);
    run.status = "completed";
    console.log(`\n✅ 완료 — Pass: ${run.passed} / Fail: ${run.failed}`);
  } catch (err: any) {
    run.status = "failed";
    run.error = err.message;
  }

  saveRun(run);
  return run;
}

// ── 자연어 파이프라인 (Vision 에이전트) ──────────────────────────────
export interface LoginConfig {
  fields: { label: string; value: string; isPassword: boolean }[];
}

export async function runNaturalLanguagePipeline(
  runId: string,
  targetUrl: string,
  scenarioList: string[],
  executor?: string,
  preconditions?: string[],
  loginConfig?: LoginConfig
): Promise<RunResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    const run: RunResult = {
      runId, status: "failed", mode: "natural",
      total: 0, passed: 0, failed: 0, cases: [],
      createdAt: new Date().toISOString(),
      error: "ANTHROPIC_API_KEY가 필요합니다.",
    };
    activeRuns.set(runId, run);
    saveRun(run);
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
  saveRun(run);

  const screenshotDir = path.resolve("data/screenshots");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const BASE_URL = process.env.WORKER_BASE_URL || "http://localhost:8001";
  void BASE_URL; // 실패 스크린샷 URL에서만 사용

  const control = {
    isCancelled: () => cancelledRuns.has(runId),
    isPaused: () => pausedRuns.has(runId),
  };

  // 브라우저 + 컨텍스트 + 페이지를 런 전체에서 공유 — 세션이 끊기지 않음
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // 첫 페이지 로드
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

  // 로그인 선행 작업
  if (loginConfig && loginConfig.fields.some((f) => f.value.trim())) {
    const credLines = loginConfig.fields
      .filter((f) => f.value.trim())
      .map((f) => `- ${f.label || "필드"}: ${f.isPassword ? "(비밀번호 입력됨)" : f.value}`);
    const loginTask = [
      "[로그인 선행 작업 — 아래 정보로 로그인 후 완료(done)하세요]",
      ...loginConfig.fields.filter((f) => f.value.trim()).map((f) => `- ${f.label || "필드"}: ${f.value}`),
      "",
      "로그인 폼을 찾아 위 정보를 입력하고 로그인 버튼을 클릭하세요. 로그인이 완료되면 done 액션을 사용하세요.",
    ].join("\n");

    console.log(`\n🔑 [${runId}] 로그인 선행 작업 시작\n${credLines.join("\n")}`);
    const loginResult = await runVisionAgent(page, loginTask, 15, undefined, control);
    if (loginResult.success) {
      console.log(`\n✅ [${runId}] 로그인 완료 (현재 URL: ${page.url()})`);
    } else {
      console.warn(`\n⚠️ [${runId}] 로그인 실패: ${loginResult.failReason} — 계속 진행합니다`);
    }
  }

  try {
    for (let i = 0; i < scenarioList.length; i++) {
      if (control.isCancelled()) {
        console.log(`\n🛑 [${runId}] 중지됨 — 남은 케이스 건너뜀`);
        break;
      }

      // 일시정지 대기
      while (control.isPaused()) {
        await new Promise((r) => setTimeout(r, 1000));
        if (control.isCancelled()) break;
      }
      if (control.isCancelled()) break;

      const naturalText = scenarioList[i];
      const precondition = preconditions?.[i]?.trim() || "";
      const taskPrompt = precondition
        ? `[전제 조건: ${precondition}]\n\n${naturalText}`
        : naturalText;
      const testId = `V-${String(i + 1).padStart(3, "0")}`;

      // 케이스 시작 전 헬스체크 — 페이지가 오류 상태인지 확인
      try {
        const title = await page.title();
        const isErrorPage = /404|403|500|error|not found/i.test(title);
        if (isErrorPage) {
          console.warn(`  [${testId}] 헬스체크: 오류 페이지 감지 (title="${title}") → 대상 URL로 재진입`);
          await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
        }
      } catch {
        // 헬스체크 실패해도 계속 진행
      }

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

      run.cases = [...run.cases.filter((c) => c.testId !== testId), result];

      const caseStartedAt = Date.now();
      try {
        console.log(`\n🤖 [${testId}] Vision 에이전트 시작 → ${page.url()}`);

        const liveStepLogs: string[] = [];

        const visionResult = await runVisionAgent(page, taskPrompt, 20, (step) => {
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
          const shotPath = path.join(screenshotDir, `${runId}_${testId}_pass.png`);
          await page.screenshot({ path: shotPath, fullPage: true });
          result.screenshotUrl = `${BASE_URL}/data/screenshots/${runId}_${testId}_pass.png`;
          run.passed++;
          console.log(`\n✅ [${testId}] 완료 (현재 URL: ${page.url()})`);
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
        result.durationMs = Date.now() - caseStartedAt;
        result.completedAt = new Date().toISOString();
        run.cases = run.cases.map((c) => c.testId === testId ? { ...result } : c);
        saveRun(run);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  cancelledRuns.delete(runId);
  pausedRuns.delete(runId);
  run.paused = false;
  run.status = run.total > 0 && run.failed === run.total ? "failed" : "completed";
  saveRun(run);
  return run;
}
