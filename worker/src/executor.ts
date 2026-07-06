import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { UIDictionary, DSLParser } from "./parser";

export interface TestResult {
  testId: string;
  feature: string;
  scenario: string;
  status: "Pass" | "Fail" | "Pending";
  failReason: string;
  videoUrl: string;
  screenshotUrl: string;
  screenshotBase64?: string;
  consoleLogs: string[];
  durationMs?: number;
  completedAt?: string;
  verificationStatus?: "approved" | "rejected" | "pending";
  reviewReason?: string;
  tokenUsage?: number;
  /** AI가 정규화한 단계별 계획과 진행 상태 — 비개발자용 체크리스트 */
  stepPlan?: { action: string; verify: string; status: "pending" | "running" | "pass" | "fail" }[];
}

const BASE_URL = process.env.WORKER_BASE_URL || "http://localhost:8001";

function toUrl(localPath: string): string {
  if (!localPath) return "";
  const relative = path.relative(path.resolve("data"), localPath).replace(/\\/g, "/");
  return `${BASE_URL}/data/${relative}`;
}

export interface TestRunOutput {
  result: TestResult;
  storageState?: any;
}

export async function runTest(
  testCase: any,
  dictionary: UIDictionary,
  incomingStorageState?: any
): Promise<TestRunOutput> {
  const recordingDir = path.resolve(`data/recordings/${testCase.testId}`);
  const screenshotDir = path.resolve("data/screenshots");
  fs.mkdirSync(recordingDir, { recursive: true });
  fs.mkdirSync(screenshotDir, { recursive: true });

  const result: TestResult = {
    testId: testCase.testId,
    feature: testCase.feature,
    scenario: testCase.scenario,
    status: "Pending",
    failReason: "",
    videoUrl: "",
    screenshotUrl: "",
    consoleLogs: [],
  };

  const headless = process.env.HEADLESS !== "false";
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    recordVideo: { dir: recordingDir, size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
    ...(incomingStorageState ? { storageState: incomingStorageState } : {}),
  });
  const page = await context.newPage();
  page.on("console", (msg) => result.consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

  const parser = new DSLParser(dictionary);
  let outgoingStorageState: any;
  const startedAt = Date.now();

  try {
    await parser.execute(page, testCase.actions);
    if (testCase.expected?.trim().startsWith("assert")) {
      await parser.execute(page, testCase.expected);
    }
    outgoingStorageState = await context.storageState();
    result.status = "Pass";
    console.log(`  ✓ [${testCase.testId}] Pass`);

    try {
      const screenshotBuffer = await page.screenshot({ fullPage: true });
      result.screenshotBase64 = screenshotBuffer.toString("base64");
    } catch (shotErr: any) {
      console.warn(`  [${testCase.testId}] 스크린샷 캡처 실패: ${shotErr.message}`);
    }
  } catch (err: any) {
    result.status = "Fail";
    result.failReason = err.message;

    try {
      const screenshotBuffer = await page.screenshot({ fullPage: true });
      result.screenshotBase64 = screenshotBuffer.toString("base64");
    } catch (shotErr: any) {
      console.warn(`  [${testCase.testId}] 스크린샷 캡처 실패: ${shotErr.message}`);
    }
    console.log(`  ✗ [${testCase.testId}] Fail: ${err.message}`);
  } finally {
    const video = page.video();
    await context.close();
    if (video) {
      try { result.videoUrl = toUrl(await video.path()); } catch { /* 녹화 없음 */ }
    }
    await browser.close();
    result.durationMs = Date.now() - startedAt;
    result.completedAt = new Date().toISOString();
  }

  return { result, storageState: outgoingStorageState };
}
