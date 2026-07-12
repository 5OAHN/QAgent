import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { chromium } from "playwright";
import { UIDictionary } from "./parser";
import { runTest, TestResult } from "./executor";
import { analyzeFailure } from "./analyzer";
import { executeSmartLogin } from "./smart-login";
import { runAgentScenario } from "./agent-executor";
import { planScenario } from "./scenario-planner";
import { notifyRunComplete } from "./notifier";
import { recordLastRun, getTest } from "./tests-store";
import { resolveAnthropicKey } from "./api-keys";
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
  loginStatus?: "running" | "success" | "fail";
  loginFailReason?: string;
  loginSteps?: string[];
  loginConfig?: LoginConfig;
  /** 저장된 테스트에서 실행된 경우 — 원본 테스트 참조 */
  testId?: string;
  testName?: string;
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
      actions: String(row[4] || ""),
      expected: String(row[5] || ""),
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

// ── 자연어 파이프라인 (DOM 스냅샷 에이전트) ──────────────────────────────
export interface LoginConfig {
  fields: { label: string; value: string; isPassword: boolean }[];
}

export interface PipelineOpts {
  /** 저장된 테스트에서 실행된 경우 */
  testId?: string;
  testName?: string;
  /** 완료 알림 링크용 프론트엔드 origin */
  dashboardBaseUrl?: string;
  /** 스케줄러가 자동으로 트리거한 실행인지 여부 — 이력/알림 표기에 사용 */
  triggeredBySchedule?: boolean;
}

/** 직전 실행 대비 이번 케이스 상태를 분류 — 알림/리포트에서 "새로 터진 것"만 강조하기 위함 */
function classifyRegression(
  prevStatus: "Pass" | "Fail" | "Pending" | "Blocked" | undefined,
  currentStatus: "Pass" | "Fail" | "Pending" | "Blocked"
): "new_failure" | "known_issue" | "fixed" | "first_run" | "stable" {
  const isFail = (s: string) => s === "Fail" || s === "Blocked";
  if (prevStatus === undefined) return "first_run";
  if (isFail(currentStatus)) return isFail(prevStatus) ? "known_issue" : "new_failure";
  return isFail(prevStatus) ? "fixed" : "stable";
}

export async function runNaturalLanguagePipeline(
  runId: string,
  targetUrl: string,
  scenarioList: string[],
  executor?: string,
  loginConfig?: LoginConfig,
  opts?: PipelineOpts
): Promise<RunResult> {
  if (!resolveAnthropicKey()) {
    const run: RunResult = {
      runId, status: "failed", mode: "natural",
      total: 0, passed: 0, failed: 0, cases: [],
      createdAt: new Date().toISOString(),
      targetUrl,
      testId: opts?.testId,
      testName: opts?.testName,
      error: "ANTHROPIC_API_KEY가 설정되지 않았습니다. 설정 페이지에서 API 키를 등록하세요.",
    };
    activeRuns.set(runId, run);
    saveRun(run);

    // 설정 오류로 실행 자체가 시작조차 못했다는 것은 "손 떼고 맡긴" 사람이
    // 가장 먼저 알아야 하는 상황이다 — 조용히 묻히지 않도록 기록과 알림을 남긴다.
    if (opts?.testId) {
      recordLastRun(opts.testId, {
        runId, status: "failed", passed: 0, failed: 0, total: 0,
        at: new Date().toISOString(),
        triggeredBy: opts.triggeredBySchedule ? "schedule" : "manual",
      });
    }
    notifyRunComplete({
      runId, testName: opts?.testName, targetUrl,
      passed: 0, failed: 0, blocked: 0, total: 0,
      dashboardBaseUrl: opts?.dashboardBaseUrl,
      configError: run.error,
      triggeredBySchedule: opts?.triggeredBySchedule,
    }).catch(() => {});

    return run;
  }

  const run: RunResult = {
    runId, status: "running", mode: "natural",
    total: scenarioList.length, passed: 0, failed: 0, cases: [],
    createdAt: new Date().toISOString(),
    targetUrl,
    scenarios: scenarioList.join("\n\n---\n\n"),
    executor,
    loginConfig,
    testId: opts?.testId,
    testName: opts?.testName,
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

  // 저장된 테스트의 직전 실행을 찾아 testId별 이전 상태를 기록 — 회귀(신규 실패) 판정에 사용.
  // 같은 시나리오 배열 순서를 쓰는 저장 테스트에서만 의미가 있다 (testId는 배열 인덱스 기반).
  const previousStatusByTestId = new Map<string, "Pass" | "Fail" | "Pending" | "Blocked">();
  if (opts?.testId) {
    const savedTest = getTest(opts.testId);
    const prevRunId = savedTest?.lastRun?.runId;
    if (prevRunId) {
      const prevRun = activeRuns.get(prevRunId);
      for (const c of prevRun?.cases || []) previousStatusByTestId.set(c.testId, c.status);
    }
  }

  // 브라우저 + 컨텍스트 + 페이지를 런 전체에서 공유 — 세션이 끊기지 않음
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  let page = await context.newPage();

  try {
    // 첫 페이지 로드
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // 로그인 선행 작업 — 실패해도 시나리오 실행은 계속 진행하므로, 예외도 여기서 흡수해야
    // 아래 for-loop와 종료 상태(run.status) 설정까지 도달할 수 있다.
    if (loginConfig && loginConfig.fields.some((f) => f.value.trim())) {
      run.loginStatus = "running";
      run.loginSteps = [];
      saveRun(run);

      try {
        const credLines = loginConfig.fields
          .filter((f) => f.value.trim())
          .map((f) => `- ${f.label || "필드"}: ${f.isPassword ? "(비밀번호 입력됨)" : f.value}`);
        console.log(`\n🔑 [${runId}] 로그인 선행 작업 시작 (스마트 로그인)\n${credLines.join("\n")}`);

        const loginFields = loginConfig.fields.filter((f) => f.value.trim());
        const loginResult = await executeSmartLogin(page, loginFields, (step) => {
          const icon = step.action === "done" ? "✅" : step.action === "fail" || step.action === "error" ? "❌" : `[${step.stepNum}]`;
          run.loginSteps!.push(`${icon} ${step.action.toUpperCase()} ${step.details}\n    💭 ${step.thought}`);
          saveRun(run);
        }, control);

        // 로그인 에이전트가 새 탭으로 전환했을 수 있음
        page = (loginResult as any).finalPage ?? page;

        if (loginResult.success) {
          run.loginStatus = "success";
          console.log(`\n✅ [${runId}] 로그인 완료 (현재 URL: ${page.url()})`);
        } else {
          run.loginStatus = "fail";
          run.loginFailReason = loginResult.failReason || "알 수 없는 오류";
          console.warn(`\n⚠️ [${runId}] 로그인 실패: ${loginResult.failReason} — 계속 진행합니다`);
        }
      } catch (err: any) {
        run.loginStatus = "fail";
        run.loginFailReason = err.message;
        console.warn(`\n⚠️ [${runId}] 로그인 선행 작업 중 오류: ${err.message} — 계속 진행합니다`);
      }
      saveRun(run);
    }

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
        feature: "AI 에이전트",
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
        console.log(`\n🤖 [${testId}] AI 에이전트 시작 → ${page.url()}`);

        const liveStepLogs: string[] = [];
        let totalTokens = 0;

        const sync = () => {
          result.consoleLogs = [...liveStepLogs];
          run.cases = run.cases.map((c) => c.testId === testId ? { ...result } : c);
          saveRun(run);
        };

        // ── 1단계: 시나리오 분석 — 실행 가능성 판정 + 행동/검증 단위 분해 (LLM 1회) ──
        liveStepLogs.push(`🧠 PLAN 시나리오 분석 중\n    💭 실행 가능성을 판정하고 단계를 분해합니다.`);
        sync();
        const plan = await planScenario(naturalText, targetUrl, run.loginStatus === "success");
        totalTokens += plan.tokens;

        // AI가 테스트 불가로 판정 — 에이전트를 실행하지 않고 사유와 보완 가이드를 보고
        if (plan.decision === "blocked") {
          result.status = "Blocked";
          result.blockReason = plan.blockReason || "AI가 이 시나리오를 자동화 테스트로 진행할 수 없다고 판정했습니다.";
          result.failReason = result.blockReason;
          result.tokenUsage = totalTokens;
          liveStepLogs.push(`⚠️ BLOCKED 테스트 진행 불가 판정\n    💭 ${result.blockReason}`);
          run.failed++; // 집계상 실패로 계산 (성공은 아니므로)
          result.regression = classifyRegression(previousStatusByTestId.get(testId), "Blocked");
          console.log(`\n⚠️ [${testId}] 진행 불가 판정: ${result.blockReason}`);
          sync();
          continue;
        }

        result.stepPlan = plan.steps.map((s) => ({ ...s, status: "pending" as const }));
        result.assumptions = plan.assumptions;
        liveStepLogs.push(
          `📋 PLAN ${plan.steps.length}개 단계로 분해 완료\n    💭 ${plan.steps.map((s, i) => `${i + 1}. ${s.action}`).join(" / ")}`
        );
        if (plan.assumptions.length > 0) {
          liveStepLogs.push(`💡 가정 선언\n    💭 ${plan.assumptions.join(" / ")}`);
        }
        sync();
        console.log(`  [${testId}] 계획:\n${plan.steps.map((s, i) => `    ${i + 1}. ${s.action} → 확인: ${s.verify}`).join("\n")}`);

        // ── 2단계: 단계별 실행 — 각 단계는 명확한 완료 조건을 가진 작은 과업 ──
        let scenarioFailed = false;
        let failDetail = "";

        for (let sIdx = 0; sIdx < plan.steps.length; sIdx++) {
          if (control.isCancelled()) { scenarioFailed = true; failDetail = "사용자에 의해 중지되었습니다."; break; }

          const planned = plan.steps[sIdx];
          result.stepPlan![sIdx].status = "running";
          sync();

          // 복잡한 시나리오 대응 — 전체 흐름과 완료된 단계를 컨텍스트로 전달해
          // 에이전트가 "지금 어디까지 왔는지"를 알고 판단하게 한다
          const flowContext = [
            `전체 시나리오 흐름: ${plan.steps.map((s, i) => `${i + 1}. ${s.action}`).join(" → ")}`,
            sIdx > 0 ? `이미 완료된 단계: ${plan.steps.slice(0, sIdx).map((s, i) => `${i + 1}. ${s.action}`).join(" / ")}` : "",
            plan.assumptions.length > 0 ? `해석 가정: ${plan.assumptions.join(" / ")}` : "",
          ].filter(Boolean).join("\n");

          const stepTask = [
            flowContext,
            "",
            `[현재 단계 ${sIdx + 1}/${plan.steps.length}] ${planned.action}`,
            `완료 조건: ${planned.verify}`,
            "",
            "이 단계 하나만 수행하세요. 완료 조건이 화면에서 확인되면 done, 확인되지 않거나 진행 불가면 fail 하세요.",
            "단계에 조건('~라면')이 있으면 현재 화면을 보고 조건 충족 여부를 먼저 판단하세요. 조건이 해당되지 않으면 그 사실을 evidence에 적고 done 하세요.",
          ].join("\n");

          // 일시적 오류(네트워크 지연, 렌더링 타이밍 등) 필터링 — 실패 시 한 번 더 시도한 뒤에만
          // 최종 실패로 확정한다. 사람이 알림을 받았을 때 "진짜 문제"라고 신뢰할 수 있게 하기 위함.
          const MAX_STEP_ATTEMPTS = 2;
          let agentResult: Awaited<ReturnType<typeof runAgentScenario>> | undefined;
          for (let attempt = 1; attempt <= MAX_STEP_ATTEMPTS; attempt++) {
            if (attempt > 1) {
              result.retryCount = (result.retryCount || 0) + 1;
              liveStepLogs.push(`🔁 RETRY 단계 ${sIdx + 1} 재시도 (${attempt}/${MAX_STEP_ATTEMPTS})\n    💭 일시적 오류일 수 있어 한 번 더 시도합니다: ${agentResult?.failReason}`);
              sync();
              await page.waitForTimeout(1500);
            }
            agentResult = await runAgentScenario(page, stepTask, {
              maxSteps: 12,
              onStep: (step) => {
                const icon = step.action === "done" ? "✅" : step.action === "fail" || step.action === "error" ? "❌" : `[${sIdx + 1}.${step.stepNum}]`;
                liveStepLogs.push(`${icon} ${step.action.toUpperCase()} ${step.details}\n    💭 ${step.thought}`);
                sync();
              },
              control,
            });
            page = agentResult.finalPage;
            totalTokens += agentResult.totalTokens || 0;
            if (agentResult.success || control.isCancelled()) break;
          }

          if (agentResult!.success) {
            result.stepPlan![sIdx].status = "pass";
            sync();
            console.log(`  [${testId}] 단계 ${sIdx + 1}/${plan.steps.length} 통과`);
          } else {
            result.stepPlan![sIdx].status = "fail";
            scenarioFailed = true;
            failDetail = `단계 ${sIdx + 1}(${planned.action})에서 실패: ${agentResult!.failReason}`;
            sync();
            break;
          }
        }

        result.tokenUsage = totalTokens;

        if (!scenarioFailed) {
          result.status = "Pass";
          result.verificationStatus = "approved";
          liveStepLogs.push(`✅ 완료: ${plan.steps.length}개 단계 모두 통과`);
          try {
            const screenshotBuffer = await page.screenshot({ fullPage: true });
            result.screenshotBase64 = screenshotBuffer.toString("base64");
          } catch {}
          run.passed++;
          console.log(`\n✅ [${testId}] 완료 (현재 URL: ${page.url()})`);
        } else {
          result.status = "Fail";
          result.failReason = failDetail || "에이전트 실행 실패";
          try {
            const screenshotBuffer = await page.screenshot({ fullPage: true });
            result.screenshotBase64 = screenshotBuffer.toString("base64");
          } catch {}
          run.failed++;
          console.log(`\n❌ [${testId}] 실패: ${result.failReason}`);
        }
        result.regression = classifyRegression(previousStatusByTestId.get(testId), result.status);
        sync();
      } catch (err: any) {
        result.status = "Fail";
        result.failReason = err.message;
        result.regression = classifyRegression(previousStatusByTestId.get(testId), "Fail");
        try {
          const screenshotBuffer = await page.screenshot({ fullPage: true });
          result.screenshotBase64 = screenshotBuffer.toString("base64");
        } catch {}
        run.failed++;
        console.error(`\n❌ [${testId}] 오류:`, err.message);
      } finally {
        result.durationMs = Date.now() - caseStartedAt;
        result.completedAt = new Date().toISOString();
        run.cases = run.cases.map((c) => c.testId === testId ? { ...result } : c);
        saveRun(run);
      }
    }
  } catch (err: any) {
    // 첫 페이지 로드 등 루프 진입 전 단계에서 예외가 나도 종료 상태 처리까지 도달해야 한다.
    run.error = err.message;
    console.error(`\n❌ [${runId}] 파이프라인 오류:`, err.message);
  } finally {
    await context.close();
    await browser.close();
  }

  // 루프가 취소/예외로 일찍 끝나면 일부 시나리오는 case 객체가 전혀 생성되지 않을 수 있다.
  // 이 상태로 status를 종료 상태로 바꾸면 프론트엔드는 누락된 항목을 영구히 "Pending"으로 표시하게 된다 —
  // 모든 시나리오에 대해 종료 상태의 case가 반드시 존재하도록 보정한다.
  const wasCancelled = cancelledRuns.has(runId);
  for (let i = 0; i < scenarioList.length; i++) {
    const testId = `V-${String(i + 1).padStart(3, "0")}`;
    if (run.cases.some((c) => c.testId === testId)) continue;
    run.cases.push({
      testId,
      feature: "AI 에이전트",
      scenario: scenarioList[i].slice(0, 80),
      status: "Fail",
      failReason: wasCancelled ? "실행이 중지되어 처리되지 않음" : "실행이 중단되어 처리되지 않음",
      videoUrl: "",
      screenshotUrl: "",
      consoleLogs: [],
    });
    run.failed++;
  }

  cancelledRuns.delete(runId);
  pausedRuns.delete(runId);
  run.paused = false;
  run.status = run.total > 0 && run.failed === run.total ? "failed" : "completed";
  saveRun(run);

  // 저장된 테스트에서 실행됐으면 마지막 실행 요약을 테스트에 기록
  if (opts?.testId) {
    recordLastRun(opts.testId, {
      runId,
      status: run.status,
      passed: run.passed,
      failed: run.failed,
      total: run.total,
      at: new Date().toISOString(),
      triggeredBy: opts.triggeredBySchedule ? "schedule" : "manual",
    });
  }

  // 완료 알림 (웹훅 미설정 시 no-op, 실패해도 무시) — 회귀(신규 실패)와 복구를 우선 강조
  const blockedCount = run.cases.filter((c) => c.status === "Blocked").length;
  const newFailures = run.cases.filter((c) => c.regression === "new_failure");
  const fixedCases = run.cases.filter((c) => c.regression === "fixed");
  await notifyRunComplete({
    runId,
    testName: opts?.testName,
    targetUrl,
    passed: run.passed,
    failed: run.failed - blockedCount,
    blocked: blockedCount,
    total: run.total,
    dashboardBaseUrl: opts?.dashboardBaseUrl,
    newFailures: newFailures.map((c) => ({ testId: c.testId, scenario: c.scenario })),
    fixedCount: fixedCases.length,
    triggeredBySchedule: opts?.triggeredBySchedule,
  });

  return run;
}
