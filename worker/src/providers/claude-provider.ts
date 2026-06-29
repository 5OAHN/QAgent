import Anthropic from "@anthropic-ai/sdk";
import { Page } from "playwright";
import { VisionProvider, VisionStep, VisionResult, RunControl, ProviderUsage } from "./types";

const VISION_MODEL = "claude-haiku-4-5-20251001";

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
      reason: { type: "string", description: "실패 이유 (failed 액션 전용)" },
    },
    required: ["action", "thought"],
  },
};

export class ClaudeProvider implements VisionProvider {
  name = "claude";
  private client: Anthropic;
  private lastUsage: ProviderUsage | null = null;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Simple health check
      await this.client.messages.create({
        model: VISION_MODEL,
        max_tokens: 10,
        messages: [{ role: "user", content: "ok" }],
      });
      return true;
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) {
        console.warn("Claude Provider: Authentication failed");
        return false;
      }
      return true; // 다른 에러는 일시적일 수 있음
    }
  }

  async runAgent(
    page: Page,
    task: string,
    maxSteps = 20,
    onStep?: (step: VisionStep) => void,
    control?: RunControl
  ): Promise<VisionResult> {
    const steps: VisionStep[] = [];
    const actionHistory: string[] = [];
    let totalTokens = 0;

    for (let i = 0; i < maxSteps; i++) {
      if (control?.isCancelled()) {
        return { success: false, steps, failReason: "사용자에 의해 중지되었습니다.", totalTokens };
      }

      while (control?.isPaused()) {
        await new Promise((r) => setTimeout(r, 500));
        if (control.isCancelled()) {
          return { success: false, steps, failReason: "사용자에 의해 중지되었습니다.", totalTokens };
        }
      }

      const screenshot = await page.screenshot({ type: "jpeg", quality: 40 });
      const base64 = screenshot.toString("base64");

      const historyText = actionHistory.length
        ? `\n\n지금까지 수행한 액션:\n${actionHistory.map((a, idx) => `${idx + 1}. ${a}`).join("\n")}`
        : "";

      const response = await this.client.messages.create({
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

      // 토큰 사용량 수집
      if (response.usage) {
        totalTokens += (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0);
        this.lastUsage = {
          inputTokens: response.usage.input_tokens || 0,
          outputTokens: response.usage.output_tokens || 0,
        };
      }

      const toolBlock = response.content.find((b) => b.type === "tool_use");
      if (!toolBlock || toolBlock.type !== "tool_use") {
        return { success: false, steps, failReason: "AI가 액션을 결정하지 못했습니다.", totalTokens };
      }

      const input = toolBlock.input as any;
      const details = formatDetails(input);
      const step: VisionStep = { stepNum: i + 1, thought: input.thought || "", action: input.action, details };
      steps.push(step);
      actionHistory.push(`${input.action} ${details} — ${input.thought}`);
      onStep?.(step);

      console.log(`  [Step ${i + 1}] ${input.action} ${details}`);

      if (input.action === "done") return { success: true, steps, summary: input.summary, totalTokens };
      if (input.action === "failed") return { success: false, steps, failReason: input.reason, totalTokens };

      // 액션 실행
      let actionErr: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await executeAction(page, input);
          actionErr = null;
          break;
        } catch (err: any) {
          actionErr = err.message;
          if (attempt < 2) {
            console.warn(`  [Step ${i + 1}] 재시도 ${attempt + 1}/2: ${err.message}`);
            await page.waitForTimeout(500);
          }
        }
      }
      if (actionErr) {
        console.warn(`  [Step ${i + 1}] 실행 실패 (3회 시도): ${actionErr}`);
        actionHistory[actionHistory.length - 1] += ` [실패: ${actionErr}]`;
      }

      await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => {});
    }

    return { success: false, steps, failReason: `${maxSteps}단계 내에 완료하지 못했습니다.`, totalTokens };
  }

  getLastUsage(): ProviderUsage | null {
    return this.lastUsage;
  }
}

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
  const role: string = input.role || "button";
  const TIMEOUT = 2000;

  if (!target) throw new Error("click 액션에 target 텍스트가 없습니다.");

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
      return;
    } catch (err: any) {
      lastErr = err;
    }
  }

  throw new Error(`"${target}" 요소를 찾지 못했습니다 (${strategies.length}가지 방법 모두 실패): ${lastErr?.message}`);
}

function formatDetails(input: any): string {
  switch (input.action) {
    case "click":
      return input.target ? `"${input.target}"` : "";
    case "type":
      return `"${input.text}"`;
    case "press":
      return input.text || "Enter";
    case "scroll":
      return `${input.direction} ${input.amount || 400}px`;
    case "wait":
      return `${input.amount || 1500}ms`;
    case "done":
      return input.summary || "완료";
    case "failed":
      return input.reason || "실패";
    default:
      return "";
  }
}
