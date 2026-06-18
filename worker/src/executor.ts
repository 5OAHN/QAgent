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
  consoleLogs: string[];
}

const BASE_URL = process.env.WORKER_BASE_URL || "http://localhost:8001";

function toUrl(localPath: string): string {
  if (!localPath) return "";
  const relative = path.relative(path.resolve("data"), localPath).replace(/\\/g, "/");
  return `${BASE_URL}/data/${relative}`;
}

export async function runTest(testCase: any, dictionary: UIDictionary): Promise<TestResult> {
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
  });
  const page = await context.newPage();
  page.on("console", (msg) => result.consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

  const parser = new DSLParser(dictionary);

  try {
    await parser.execute(page, testCase.actions);
    if (testCase.expected?.trim().startsWith("assert")) {
      await parser.execute(page, testCase.expected);
    }
    result.status = "Pass";
    console.log(`  ✓ [${testCase.testId}] Pass`);
  } catch (err: any) {
    result.status = "Fail";
    result.failReason = err.message;

    const shotPath = path.join(screenshotDir, `${testCase.testId}_fail.png`);
    await page.screenshot({ path: shotPath, fullPage: true });
    result.screenshotUrl = toUrl(shotPath);
    console.log(`  ✗ [${testCase.testId}] Fail: ${err.message}`);
  } finally {
    // video.path()는 context.close() 이전에 호출해야 함
    const video = page.video();
    await context.close(); // 이 시점에 영상 파일 저장 완료
    if (video) {
      try { result.videoUrl = toUrl(await video.path()); } catch { /* 녹화 없음 */ }
    }
    await browser.close();
  }

  return result;
}
