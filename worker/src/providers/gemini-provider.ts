import { Page } from "playwright";
import { VisionProvider, VisionStep, VisionResult, RunControl, ProviderUsage } from "./types";

const VISION_MODEL = "gemini-2.0-flash";

const SYSTEM_PROMPT = `You are a web automation agent controlling a real browser. You will be shown a screenshot and a task.
Analyze the screenshot carefully and decide the SINGLE next action to take.

CRITICAL RULES:
1. NEVER use pixel coordinates (x, y) to click.
2. ALWAYS identify the visible text label or ARIA role of the element you want to click.
3. If an element has no text, describe it by its role + surrounding context.

Actions: click, type, press, scroll, wait, done, failed

Always respond in valid JSON format with: thought (Korean), action, target, method, etc.`;

export class GeminiProvider implements VisionProvider {
  name = "gemini";
  private apiKey: string;
  private lastUsage: ProviderUsage | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "hello" }] }],
          }),
        }
      );
      return response.ok || response.status !== 401;
    } catch (err) {
      return true;
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

      const prompt = `Task: ${task}${historyText}

Please respond with a JSON object containing:
{
  "thought": "한국어로 현재 화면 상태와 다음 액션을 선택한 이유",
  "action": "click|type|press|scroll|wait|done|failed",
  "target": "요소의 텍스트 또는 설명 (click 액션 시)",
  "method": "text|role|label",
  "text": "입력할 텍스트 또는 키 이름",
  "direction": "up|down (scroll 액션 시)",
  "amount": "숫자",
  "summary": "완료 요약 (done 액션 시)",
  "reason": "실패 이유 (failed 액션 시)"
}`;

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${this.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: SYSTEM_PROMPT }],
              },
              contents: [
                {
                  parts: [
                    { inline_data: { mime_type: "image/jpeg", data: base64 } },
                    { text: prompt },
                  ],
                },
              ],
              generationConfig: {
                maxOutputTokens: 1024,
                temperature: 0.7,
              },
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          const errorMsg = data.error?.message || "Unknown error";
          if (response.status === 429 || errorMsg.includes("quota") || errorMsg.includes("exhausted")) {
            throw new Error("GEMINI_QUOTA_EXCEEDED");
          }
          throw new Error(errorMsg);
        }

        // 토큰 사용량 수집
        if (data.usageMetadata) {
          totalTokens += (data.usageMetadata.promptTokenCount || 0) + (data.usageMetadata.candidatesTokenCount || 0);
          this.lastUsage = {
            inputTokens: data.usageMetadata.promptTokenCount || 0,
            outputTokens: data.usageMetadata.candidatesTokenCount || 0,
          };
        }

        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) {
          return { success: false, steps, failReason: "Gemini가 응답을 제공하지 못했습니다.", totalTokens };
        }

        let input: any;
        try {
          // JSON 추출 (마크다운 코드 블록 처리)
          const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
          input = JSON.parse(jsonStr);
        } catch (e) {
          return { success: false, steps, failReason: "AI 응답을 파싱하지 못했습니다.", totalTokens };
        }

        const details = formatDetails(input);
        const step: VisionStep = { stepNum: i + 1, thought: input.thought || "", action: input.action, details };
        steps.push(step);
        actionHistory.push(`${input.action} ${details} — ${input.thought}`);
        onStep?.(step);

        console.log(`  [Step ${i + 1}] ${input.action} ${details}`);

        if (input.action === "done") return { success: true, steps, summary: input.summary, totalTokens };
        if (input.action === "failed") return { success: false, steps, failReason: input.reason, totalTokens };

        // 액션 실행 (Claude와 동일)
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

        await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => {});
      } catch (err: any) {
        console.error(`  [Step ${i + 1}] Gemini 호출 실패: ${err.message}`);
        if (err.message === "GEMINI_QUOTA_EXCEEDED") {
          throw err; // Provider Manager에서 폴백 처리
        }
        return { success: false, steps, failReason: `Gemini 오류: ${err.message}`, totalTokens };
      }
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
      const target: string = input.target || "";
      const method: string = input.method || "text";
      const TIMEOUT = 2000;

      if (!target) throw new Error("target이 없습니다");

      const strategies: Array<() => Promise<void>> = [];
      if (method === "role") {
        strategies.push(async () => {
          await page.getByRole(input.role || "button", { name: target }).waitFor({ timeout: TIMEOUT });
          await page.getByRole(input.role || "button", { name: target }).click();
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
          await page.getByText(target, { exact: true }).first().waitFor({ timeout: TIMEOUT });
          await page.getByText(target, { exact: true }).first().click();
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
      throw lastErr;
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
