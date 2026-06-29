import Anthropic from "@anthropic-ai/sdk";
import { Page } from "playwright";
import { runVisionAgent, VisionResult, VisionStep, RunControl } from "./vision-agent";

const PLAN_MODEL = "claude-haiku-4-5";

interface DomElement {
  qid: number;
  tag: string;
  type?: string;
  role?: string;
  text?: string;
  placeholder?: string;
  ariaLabel?: string;
}

// ── 화면의 상호작용 가능한 요소만 가볍게 추출 (스크린샷 없이 텍스트 JSON만) ──
async function extractElements(page: Page): Promise<DomElement[]> {
  return page.evaluate(() => {
    const selector = [
      "input", "button", "a", "select", "textarea",
      '[role="button"]', '[role="checkbox"]', '[role="menuitem"]',
      '[role="tab"]', '[role="link"]', '[role="option"]', "[onclick]",
    ].join(", ");
    const candidates = Array.from(document.querySelectorAll(selector)) as HTMLElement[];

    const result: DomElement[] = [];
    candidates.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      el.setAttribute("data-qagent-id", String(i));
      const input = el as HTMLInputElement;
      result.push({
        qid: i,
        tag: el.tagName.toLowerCase(),
        type: input.type || undefined,
        role: el.getAttribute("role") || undefined,
        text: el.textContent?.trim().slice(0, 50) || undefined,
        placeholder: input.placeholder || undefined,
        ariaLabel: el.getAttribute("aria-label") || undefined,
      });
    });
    return result;
  });
}

// ── 자연어 스텝을 숫자 목록 기준으로 분리. 목록 형태가 아니면 null (전체를 비전 에이전트로 처리) ──
function splitSteps(naturalText: string): string[] | null {
  const matches = Array.from(naturalText.matchAll(/\d+\.\s*([^\n]+)/g));
  if (matches.length < 2) return null; // 스텝이 1개뿐이면 분리 이득이 적어 비전 루프가 더 안전
  return matches.map((m) => m[1].trim()).filter(Boolean);
}

const PLAN_STEP_TOOL = {
  name: "plan_step",
  description: "자연어 스텝 하나를 분석해 어떤 액션을 어떤 요소에 수행해야 하는지만 결정한다. 액션을 직접 수행하지 않는다.",
  input_schema: {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["click", "fill", "assert_text", "wait", "press", "goto"],
        description: "click=클릭, fill=텍스트입력, assert_text=텍스트가 보이는지 확인, wait=대기, press=키 입력, goto=URL 이동",
      },
      qid: { type: "number", description: "click/fill 대상 요소의 qid. 해당 없거나 못 찾으면 -1" },
      value: {
        type: "string",
        description: "fill=입력할 텍스트, assert_text=찾을 텍스트, wait=밀리초(숫자), press=키 이름(Enter 등), goto=URL. 해당 없으면 빈 문자열",
      },
    },
    required: ["action", "qid", "value"],
  },
};

async function planStep(
  elements: DomElement[],
  stepText: string,
  currentUrl: string
): Promise<{ action: string; qid: number; value: string } | null> {
  const client = new Anthropic();
  const systemPrompt = [
    "당신은 웹 자동화 스텝을 분석하는 역할만 합니다. 직접 클릭하거나 입력하지 않습니다.",
    "주어진 DOM 요소 목록(JSON)과 자연어 스텝 하나를 보고, 어떤 액션을 어떤 요소에 수행해야 하는지만 결정해서 반환하십시오.",
    "명확히 매칭되는 요소가 없으면 qid를 -1로 반환하십시오. 추측하지 마십시오.",
  ].join("\n");

  const userMessage = [
    `현재 URL: ${currentUrl}`,
    `DOM 요소 목록:\n${JSON.stringify(elements)}`,
    "",
    `수행할 스텝: ${stepText}`,
  ].join("\n");

  try {
    const res = await client.messages.create({
      model: PLAN_MODEL,
      max_tokens: 300,
      system: systemPrompt,
      tools: [PLAN_STEP_TOOL],
      tool_choice: { type: "tool", name: "plan_step" },
      messages: [{ role: "user", content: userMessage }],
    });
    const toolBlock = res.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") return null;
    return toolBlock.input as { action: string; qid: number; value: string };
  } catch {
    return null;
  }
}

async function executeStep(page: Page, plan: { action: string; qid: number; value: string }): Promise<void> {
  const selector = `[data-qagent-id="${plan.qid}"]`;
  switch (plan.action) {
    case "click":
      if (plan.qid === -1) throw new Error("클릭할 요소를 찾지 못했습니다.");
      await page.click(selector, { timeout: 6000 });
      break;
    case "fill":
      if (plan.qid === -1) throw new Error("입력할 요소를 찾지 못했습니다.");
      await page.fill(selector, plan.value, { timeout: 6000 });
      break;
    case "assert_text":
      await page.getByText(plan.value, { exact: false }).first().waitFor({ state: "visible", timeout: 8000 });
      break;
    case "wait":
      await page.waitForTimeout(parseInt(plan.value, 10) || 1000);
      break;
    case "press":
      await page.keyboard.press(plan.value || "Enter");
      break;
    case "goto":
      await page.goto(plan.value, { waitUntil: "domcontentloaded", timeout: 15000 });
      break;
    default:
      throw new Error(`알 수 없는 액션: ${plan.action}`);
  }
  await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
}

// ── 통합 함수 — 숫자 목록 스텝마다 Plan(LLM 1회) → Execute(룰베이스) 순서로 실행 ──
// 실패한 스텝은 그 스텝만 비전 에이전트로 폴백하고, 목록 형태가 아니면 전체를 비전 에이전트로 위임한다.
export async function runSmartScenario(
  page: Page,
  naturalText: string,
  maxSteps = 20,
  onStep?: (step: VisionStep) => void,
  control?: RunControl
): Promise<VisionResult> {
  const steps = splitSteps(naturalText);
  if (!steps) {
    return runVisionAgent(page, naturalText, maxSteps, onStep, control);
  }

  const collected: VisionStep[] = [];
  let stepNum = 0;
  let fallbackCount = 0;  // 폴백 발생 여부 추적

  for (const stepText of steps) {
    if (control?.isCancelled()) {
      return { success: false, steps: collected, failReason: "사용자에 의해 중지되었습니다." };
    }
    while (control?.isPaused()) {
      await new Promise((r) => setTimeout(r, 500));
      if (control?.isCancelled()) {
        return { success: false, steps: collected, failReason: "사용자에 의해 중지되었습니다." };
      }
    }

    stepNum++;
    try {
      const elements = await extractElements(page);
      const plan = await planStep(elements, stepText, page.url());
      if (!plan) throw new Error("LLM이 계획을 반환하지 못했습니다.");

      await executeStep(page, plan);

      const step: VisionStep = {
        stepNum, action: plan.action,
        thought: `룰베이스로 즉시 처리 — "${stepText}"`,
        details: plan.action === "fill" ? `"${plan.value}"` : plan.value || `qid=${plan.qid}`,
      };
      collected.push(step);
      onStep?.(step);
    } catch (err: any) {
      // 이 스텝만 비전 에이전트로 재시도 (전체 시나리오 재시도 아님 — 비용/시간 절약)
      fallbackCount++;
      console.warn(`  [smart-executor] 스텝 "${stepText}" 룰베이스 실패(${err.message}) — 비전 에이전트로 재시도`);
      const fallbackStep: VisionStep = {
        stepNum, action: "fallback",
        thought: `룰베이스 실패(${err.message}) — 화면 인식 기반으로 재시도합니다.`,
        details: stepText,
      };
      collected.push(fallbackStep);
      onStep?.(fallbackStep);

      const fallbackResult = await runVisionAgent(page, stepText, 6, (s) => {
        const wrapped = { ...s, stepNum: stepNum + s.stepNum * 0.1 };
        collected.push(wrapped);
        onStep?.(wrapped);
      }, control);

      if (!fallbackResult.success) {
        return { success: false, steps: collected, failReason: `"${stepText}" 단계 실패: ${fallbackResult.failReason}` };
      }
    }
  }

  // 폴백이 있었으면 Review 상태로 반환
  const verificationStatus = fallbackCount > 0 ? "pending" : "approved";
  const reviewReason = fallbackCount > 0 ? `${fallbackCount}개 스텝이 비전 에이전트로 폴백됨` : undefined;

  return {
    success: true,
    steps: collected,
    summary: `${steps.length}개 스텝 모두 완료`,
    verificationStatus,
    reviewReason,
  };
}
