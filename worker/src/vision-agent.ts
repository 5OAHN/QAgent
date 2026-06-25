import Anthropic from "@anthropic-ai/sdk";
import { Page } from "playwright";

const VISION_MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `You are a web automation agent controlling a real browser. You will be shown a screenshot and a task.
Analyze the screenshot carefully and decide the SINGLE next action to take.

## CRITICAL RULES — NEVER VIOLATE:
1. **NEVER use pixel coordinates (x, y) to click.** Coordinate-based clicking is FORBIDDEN.
2. **ALWAYS identify the visible text label or ARIA role of the element you want to click**, then use the "target" field with that exact text.
3. If an element has no text, describe it by its role + surrounding context (e.g. "submit button after password field").

## Action Guide:
- **click**: Set "target" to the exact visible text on the button/link/element. Set "method" to "text", "role", or "label".
  - "text": use when the element has visible text (most cases)
  - "role": use when you know the semantic role (button, link, checkbox, etc.)
  - "label": use when it's an input labeled by aria-label or form label
- **type**: Type text into the currently focused input. Use AFTER clicking the input field.
- **press**: Press a keyboard key (Enter, Tab, Escape, ArrowDown, etc.)
- **scroll**: Scroll the page up or down to reveal hidden elements.
- **wait**: Wait for the page to load or an animation to complete.
- **done**: Mark the task complete with a summary. ONLY when the ENTIRE task is finished.
- **failed**: Mark as failed if the task is truly impossible after multiple attempts.

## Retry Strategy:
- If you just clicked something and nothing happened, try a different method ("role" instead of "text").
- If a page is loading, use "wait" before the next click.
- If you can't find an element, scroll down first to check if it's off-screen.
- Never give up after just one failure — try at least 2-3 approaches.

## Output Language:
- Always write the "thought" field in Korean (한국어). Describe what you see and what you will do next.`;

const ACTION_TOOL = {
  name: "execute_action",
  description: "Execute the next browser action using text/role-based element targeting (NO coordinates)",
  input_schema: {
    type: "object" as const,
    properties: {
      thought: {
        type: "string",
        description: "한국어로 현재 화면 상태와 다음 액션을 선택한 이유를 설명하세요.",
      },
      action: {
        type: "string",
        enum: ["click", "type", "press", "scroll", "wait", "done", "failed"],
      },
      target: {
        type: "string",
        description: "클릭할 요소의 정확한 텍스트 또는 설명 (click 액션 전용). 예: '로그인', '확인', '메뉴 열기'",
      },
      method: {
        type: "string",
        enum: ["text", "role", "label"],
        description: "요소 탐색 방식. text=텍스트 내용으로 찾기, role=ARIA 역할로 찾기, label=라벨로 찾기 (기본값: text)",
      },
      role: {
        type: "string",
        description: "method=role 일 때 ARIA 역할. 예: button, link, checkbox, menuitem, tab",
      },
      text: {
        type: "string",
        description: "type 액션: 입력할 텍스트 / press 액션: 키 이름 (Enter, Tab, Escape, ArrowDown 등)",
      },
      direction: {
        type: "string",
        enum: ["up", "down"],
        description: "스크롤 방향 (scroll 액션 전용)",
      },
      amount: {
        type: "number",
        description: "스크롤 픽셀 (기본 400) 또는 대기 ms (기본 1500)",
      },
      summary: { type: "string", description: "완료된 내용 요약 (done 액션 전용)" },
      reason:  { type: "string", description: "실패 이유 (failed 액션 전용)" },
    },
    required: ["action", "thought"],
  },
};

export interface VisionStep {
  stepNum: number;
  thought: string;
  action: string;
  details: string;
}

export interface VisionResult {
  success: boolean;
  steps: VisionStep[];
  failReason?: string;
  summary?: string;
}

const UX_REVIEW_TOOL = {
  name: "ux_suggestions",
  description: "Provide UX improvement suggestions based on what you observed while testing",
  input_schema: {
    type: "object" as const,
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            area:       { type: "string", description: "어떤 영역/화면인지 (예: 로그인 폼, 네비게이션, 에러 메시지)" },
            issue:      { type: "string", description: "발견된 UX 문제점을 구체적으로 설명" },
            suggestion: { type: "string", description: "개선 방향 제안 (구체적으로)" },
          },
          required: ["area", "issue", "suggestion"],
        },
      },
    },
    required: ["suggestions"],
  },
};

export async function analyzeUX(
  page: Page,
  task: string,
  steps: VisionStep[]
): Promise<{ area: string; issue: string; suggestion: string }[]> {
  const client = new Anthropic();
  const screenshot = await page.screenshot({ type: "png" });
  const base64 = screenshot.toString("base64");
  const actionSummary = steps
    .map((s) => `Step ${s.stepNum}: ${s.action} ${s.details} — ${s.thought}`)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: `당신은 시니어 UX 디자이너입니다. 방금 웹 애플리케이션을 자동화 에이전트로서 직접 사용해봤습니다.
테스트 중 관찰한 내용을 바탕으로 실질적인 UX 개선 제안을 해주세요.
- 실제로 겪은 불편함이나 문제점만 언급하세요.
- 추상적인 말보다 구체적인 개선 방법을 제시하세요.
- 2~5개 사이로 제안하세요.`,
      tools: [UX_REVIEW_TOOL],
      tool_choice: { type: "tool", name: "ux_suggestions" },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: base64 } },
          { type: "text", text: `테스트 작업: ${task}\n\n수행한 액션 히스토리:\n${actionSummary}\n\n위 테스트를 진행하면서 발견한 UX 문제점과 개선 제안을 해주세요.` },
        ],
      }],
    });

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") return [];
    const input = toolBlock.input as any;
    return Array.isArray(input.suggestions) ? input.suggestions : [];
  } catch (err: any) {
    console.warn("UX 분석 실패:", err.message);
    return [];
  }
}

export interface RunControl {
  isCancelled: () => boolean;
  isPaused: () => boolean;
}

export async function runVisionAgent(
  page: Page,
  task: string,
  maxSteps = 20,
  onStep?: (step: VisionStep) => void,
  control?: RunControl
): Promise<VisionResult> {
  const client = new Anthropic();
  const steps: VisionStep[] = [];
  const actionHistory: string[] = [];

  for (let i = 0; i < maxSteps; i++) {
    if (control?.isCancelled()) {
      return { success: false, steps, failReason: "사용자에 의해 중지되었습니다." };
    }

    while (control?.isPaused()) {
      await new Promise((r) => setTimeout(r, 500));
      if (control.isCancelled()) {
        return { success: false, steps, failReason: "사용자에 의해 중지되었습니다." };
      }
    }

    const screenshot = await page.screenshot({ type: "jpeg", quality: 40 });
    const base64 = screenshot.toString("base64");

    const historyText = actionHistory.length
      ? `\n\n지금까지 수행한 액션:\n${actionHistory.map((a, idx) => `${idx + 1}. ${a}`).join("\n")}`
      : "";

    const response = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [ACTION_TOOL],
      tool_choice: { type: "tool", name: "execute_action" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
            { type: "text", text: `Task: ${task}${historyText}\n\n다음 액션을 결정하세요. 좌표 클릭은 절대 사용하지 마세요.` },
          ],
        },
      ],
    });

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      return { success: false, steps, failReason: "AI가 액션을 결정하지 못했습니다." };
    }

    const input = toolBlock.input as any;
    const details = formatDetails(input);
    const step: VisionStep = { stepNum: i + 1, thought: input.thought || "", action: input.action, details };
    steps.push(step);
    actionHistory.push(`${input.action} ${details} — ${input.thought}`);
    onStep?.(step);

    console.log(`  [Step ${i + 1}] ${input.action} ${details}`);

    if (input.action === "done")   return { success: true,  steps, summary: input.summary };
    if (input.action === "failed") return { success: false, steps, failReason: input.reason };

    try {
      await executeAction(page, input);
    } catch (err: any) {
      console.warn(`  [Step ${i + 1}] 실행 실패: ${err.message}`);
      // 실패를 actionHistory에 기록해 AI가 다른 방법을 시도하도록 유도
      actionHistory[actionHistory.length - 1] += ` [실패: ${err.message}]`;
    }

    await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => {});
  }

  return { success: false, steps, failReason: `${maxSteps}단계 내에 완료하지 못했습니다.` };
}

// ── DOM/Text 기반 액션 실행기 ──────────────────────────────────────────────
async function executeAction(page: Page, input: any): Promise<void> {
  switch (input.action) {
    case "click": {
      await clickByText(page, input);
      break;
    }
    case "type":
      await page.keyboard.type(input.text || "", { delay: 40 });
      break;
    case "press":
      await page.keyboard.press(input.text || "Enter");
      break;
    case "scroll":
      await page.mouse.wheel(0, input.direction === "down" ? (input.amount || 400) : -(input.amount || 400));
      break;
    case "wait":
      await page.waitForTimeout(input.amount || 1500);
      break;
  }
}

async function clickByText(page: Page, input: any): Promise<void> {
  const target: string = input.target || "";
  const method: string = input.method || "text";
  const role: string   = input.role || "button";
  const TIMEOUT = 2000;

  if (!target) throw new Error("click 액션에 target 텍스트가 없습니다.");

  // 시도 순서: 지정 method → fallback 방식들 순으로 재시도
  const strategies: Array<() => Promise<void>> = [];

  if (method === "role") {
    strategies.push(async () => {
      await page.getByRole(role as any, { name: target }).waitFor({ timeout: TIMEOUT });
      await page.getByRole(role as any, { name: target }).click();
    });
  }

  if (method === "label") {
    strategies.push(async () => {
      await page.getByLabel(target).waitFor({ timeout: TIMEOUT });
      await page.getByLabel(target).click();
    });
  }

  // 텍스트 기반 (항상 fallback으로 포함)
  strategies.push(
    async () => {
      await page.getByRole("button", { name: target }).waitFor({ timeout: TIMEOUT });
      await page.getByRole("button", { name: target }).click();
    },
    async () => {
      await page.getByRole("link", { name: target }).waitFor({ timeout: TIMEOUT });
      await page.getByRole("link", { name: target }).click();
    },
    async () => {
      await page.getByText(target, { exact: true }).first().waitFor({ timeout: TIMEOUT });
      await page.getByText(target, { exact: true }).first().click();
    },
    async () => {
      await page.getByText(target, { exact: false }).first().waitFor({ timeout: TIMEOUT });
      await page.getByText(target, { exact: false }).first().click();
    },
    async () => {
      await page.locator(`[aria-label="${target}"]`).waitFor({ timeout: TIMEOUT });
      await page.locator(`[aria-label="${target}"]`).click();
    },
    async () => {
      await page.locator(`[placeholder*="${target}"]`).waitFor({ timeout: TIMEOUT });
      await page.locator(`[placeholder*="${target}"]`).click();
    }
  );

  let lastErr: Error | null = null;
  for (const strategy of strategies) {
    try {
      await strategy();
      return; // 성공
    } catch (err: any) {
      lastErr = err;
    }
  }

  throw new Error(`"${target}" 요소를 찾지 못했습니다 (${strategies.length}가지 방법 모두 실패): ${lastErr?.message}`);
}

function formatDetails(input: any): string {
  switch (input.action) {
    case "click":   return input.target ? `"${input.target}"` : "";
    case "type":    return `"${input.text}"`;
    case "press":   return input.text || "Enter";
    case "scroll":  return `${input.direction} ${input.amount || 400}px`;
    case "wait":    return `${input.amount || 1500}ms`;
    case "done":    return input.summary || "완료";
    case "failed":  return input.reason || "실패";
    default:        return "";
  }
}
