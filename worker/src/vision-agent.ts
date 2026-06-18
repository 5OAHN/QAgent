import Anthropic from "@anthropic-ai/sdk";
import { Page } from "playwright";

const VISION_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a web automation agent controlling a real browser. You will be shown a screenshot and a task.
Analyze the screenshot carefully and decide the SINGLE next action to take.

Rules:
- Click elements by their center pixel coordinates (x, y)
- For input fields: click the field first, then use type action
- After filling a form, click the submit/login button
- If page is loading, use wait action
- Scroll down if you need to find elements not visible
- Mark done ONLY when the entire task is fully completed
- Mark failed if the task is truly impossible or you are stuck in a loop

IMPORTANT: Always write the "thought" field in Korean (한국어). Describe what you see and why you chose this action in Korean.`;

const ACTION_TOOL = {
  name: "execute_action",
  description: "Execute the next browser action",
  input_schema: {
    type: "object" as const,
    properties: {
      thought: { type: "string", description: "What you see and why you chose this action" },
      action: {
        type: "string",
        enum: ["click", "type", "press", "scroll", "wait", "done", "failed"],
      },
      x: { type: "number", description: "X pixel coordinate (for click)" },
      y: { type: "number", description: "Y pixel coordinate (for click)" },
      text: { type: "string", description: "Text to type, or key name to press (e.g. Enter, Tab)" },
      direction: { type: "string", enum: ["up", "down"], description: "Scroll direction" },
      amount: { type: "number", description: "Scroll pixels (default 300) or wait ms (default 1000)" },
      summary: { type: "string", description: "What was accomplished (for done)" },
      reason: { type: "string", description: "Why it failed (for failed)" },
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

export interface RunControl {
  isCancelled: () => boolean;
  isPaused: () => boolean;
}

export async function runVisionAgent(
  page: Page,
  task: string,
  maxSteps = 25,
  onStep?: (step: VisionStep) => void,
  control?: RunControl
): Promise<VisionResult> {
  const client = new Anthropic();
  const steps: VisionStep[] = [];
  const actionHistory: string[] = [];

  for (let i = 0; i < maxSteps; i++) {
    // 중지 확인
    if (control?.isCancelled()) {
      return { success: false, steps, failReason: "사용자에 의해 중지되었습니다." };
    }

    // 일시정지 대기 (500ms 간격으로 폴링)
    while (control?.isPaused()) {
      await new Promise((r) => setTimeout(r, 500));
      if (control.isCancelled()) {
        return { success: false, steps, failReason: "사용자에 의해 중지되었습니다." };
      }
    }

    const screenshot = await page.screenshot({ type: "png" });
    const base64 = screenshot.toString("base64");

    const historyText = actionHistory.length
      ? `\n\nActions taken so far:\n${actionHistory.map((a, idx) => `${idx + 1}. ${a}`).join("\n")}`
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
            {
              type: "image",
              source: { type: "base64", media_type: "image/png", data: base64 },
            },
            {
              type: "text",
              text: `Task: ${task}${historyText}\n\nWhat is the next action?`,
            },
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
    actionHistory.push(`${input.action}${details ? ` ${details}` : ""} — ${input.thought}`);
    onStep?.(step);

    console.log(`  [Step ${i + 1}] ${input.action} ${details}`);

    if (input.action === "done") return { success: true, steps, summary: input.summary };
    if (input.action === "failed") return { success: false, steps, failReason: input.reason };

    try {
      await executeAction(page, input);
    } catch (err: any) {
      console.warn(`  [Step ${i + 1}] 실행 실패: ${err.message}`);
    }

    await page.waitForTimeout(800);
  }

  return { success: false, steps, failReason: `${maxSteps}단계 내에 완료하지 못했습니다.` };
}

async function executeAction(page: Page, input: any): Promise<void> {
  switch (input.action) {
    case "click":
      await page.mouse.click(input.x, input.y);
      break;
    case "type":
      await page.keyboard.type(input.text || "", { delay: 50 });
      break;
    case "press":
      await page.keyboard.press(input.text || "Enter");
      break;
    case "scroll":
      await page.mouse.wheel(0, input.direction === "down" ? (input.amount || 300) : -(input.amount || 300));
      break;
    case "wait":
      await page.waitForTimeout(input.amount || 1000);
      break;
  }
}

function formatDetails(input: any): string {
  switch (input.action) {
    case "click":   return `(${input.x}, ${input.y})`;
    case "type":    return `"${input.text}"`;
    case "press":   return input.text || "Enter";
    case "scroll":  return `${input.direction} ${input.amount || 300}px`;
    case "wait":    return `${input.amount || 1000}ms`;
    case "done":    return input.summary || "완료";
    case "failed":  return input.reason || "실패";
    default:        return "";
  }
}
