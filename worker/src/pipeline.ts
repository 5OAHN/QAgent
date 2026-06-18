import * as XLSX from "xlsx";
import path from "path";
import { UIDictionary } from "./parser";
import { runTest, TestResult } from "./executor";
import { analyzeFailure, convertNaturalLanguageToDSL } from "./analyzer";

export interface RunResult {
  runId: string;
  status: "running" | "completed" | "failed";
  total: number;
  passed: number;
  failed: number;
  cases: TestResult[];
  createdAt: string;
  mode: "excel" | "natural";
  error?: string;
}

const activeRuns = new Map<string, RunResult>();

export function getRunResult(runId: string): RunResult | undefined {
  return activeRuns.get(runId);
}

// ── 공통: 테스트 케이스 실행 루프 ──────────────────────────────────────
async function executeTestCases(
  run: RunResult,
  testCases: any[],
  dictionary: UIDictionary
): Promise<void> {
  for (const tc of testCases) {
    console.log(`\n[${tc.testId}] ${tc.scenario}`);
    const result = await runTest(tc, dictionary);
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
  targetUrl?: string
): Promise<RunResult> {
  const dictionary = new UIDictionary(path.resolve("ui_dictionary.yaml"));

  if (targetUrl) {
    // 엑셀에 goto(대상URL) 형태로 쓸 수 있도록 동적으로 등록
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

// ── 자연어 파이프라인 ─────────────────────────────────────────────────
export async function runNaturalLanguagePipeline(
  runId: string,
  targetUrl: string,
  naturalText: string
): Promise<RunResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    const run: RunResult = {
      runId, status: "failed", mode: "natural",
      total: 0, passed: 0, failed: 0, cases: [],
      createdAt: new Date().toISOString(),
      error: "자연어 모드는 ANTHROPIC_API_KEY가 필요합니다. worker/.env 파일에 키를 추가해 주세요.",
    };
    activeRuns.set(runId, run);
    return run;
  }

  const dictionary = new UIDictionary(path.resolve("ui_dictionary.yaml"));
  // 입력된 URL을 동적으로 등록
  (dictionary as any).pages["대상URL"] = { url: targetUrl };
  (dictionary as any).pages["대상 URL"] = { url: targetUrl };

  const run: RunResult = {
    runId, status: "running", mode: "natural",
    total: 0, passed: 0, failed: 0, cases: [],
    createdAt: new Date().toISOString(),
  };
  activeRuns.set(runId, run);

  try {
    console.log(`\n🤖 GPT-4o로 자연어 시나리오 변환 중…`);
    const testCases = await convertNaturalLanguageToDSL(
      targetUrl,
      naturalText,
      dictionary.getPageNames(),
      dictionary.getElementNames()
    );

    run.total = testCases.length;
    console.log(`✅ ${testCases.length}개 테스트 케이스 생성 완료`);
    testCases.forEach((tc, i) =>
      console.log(`  [${tc.testId}] ${tc.scenario}\n    actions: ${tc.actions}`)
    );

    await executeTestCases(run, testCases, dictionary);
    run.status = "completed";
    console.log(`\n✅ 완료 — Pass: ${run.passed} / Fail: ${run.failed}`);
  } catch (err: any) {
    run.status = "failed";
    run.error = err.message;
    console.error(`\n❌ 오류:`, err.message);
  }

  return run;
}
