import { Page } from "playwright";
import { VisionStep } from "./providers/types";

export interface CodeRunResult {
  success: boolean;
  error?: string;
  steps: VisionStep[];
  totalTokens?: number;
}

// AsyncFunction 생성자 — eval 없이 동적 코드 실행
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

export async function runGeneratedCode(
  page: Page,
  code: string,
  onStep?: (step: VisionStep) => void
): Promise<CodeRunResult> {
  const steps: VisionStep[] = [];

  const report = (action: string, details: string, thought: string) => {
    const step: VisionStep = { stepNum: steps.length + 1, action, details, thought };
    steps.push(step);
    onStep?.(step);
  };

  report("codegen", "Playwright 코드 실행 시작", code.split("\n").slice(0, 3).join(" | "));

  try {
    const fn = new AsyncFunction("page", "__report__", code);
    await fn(page, report);
    report("done", "완료", "시나리오 코드 실행 성공");
    return { success: true, steps };
  } catch (err: any) {
    const message = err.message || String(err);
    report("failed", message.slice(0, 120), "코드 실행 중 오류 발생");
    return { success: false, error: message, steps };
  }
}
