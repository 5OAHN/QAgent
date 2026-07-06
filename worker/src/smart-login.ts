import Anthropic from "@anthropic-ai/sdk";
import { Page } from "playwright";
import { runAgentScenario, AgentResult, AgentStep, RunControl, SecretField } from "./agent-executor";
import { resolveAnthropicKey } from "./api-keys";

export type VisionResult = AgentResult;
export type VisionStep = AgentStep;
export type { RunControl };

const PLAN_MODEL = "claude-haiku-4-5";

export interface LoginField {
  label: string;
  value: string;
  isPassword: boolean;
}

interface DomElement {
  qid: number;
  tag: string;
  type?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  ariaLabel?: string;
  role?: string;
  text?: string;
}

// ── Step 1: DOM 경량화 추출 — 레이아웃 태그는 무시하고 입력 가능한 요소만 ──
async function extractLoginElements(page: Page): Promise<DomElement[]> {
  // JS 렌더링 완료까지 대기 — domcontentloaded 후 SPA 입력 필드가 늦게 마운트될 수 있음
  await page.waitForSelector('input', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);

  return page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll('input, button, a, [role="textbox"], [role="button"]')
    ) as HTMLElement[];

    const result: DomElement[] = [];
    candidates.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return; // 화면에 안 보이는 요소는 제외

      el.setAttribute("data-qagent-id", String(i));
      const input = el as HTMLInputElement;
      result.push({
        qid: i,
        tag: el.tagName.toLowerCase(),
        type: input.type || undefined,
        id: el.id || undefined,
        name: input.name || undefined,
        placeholder: input.placeholder || undefined,
        ariaLabel: el.getAttribute("aria-label") || undefined,
        role: el.getAttribute("role") || undefined,
        text: el.textContent?.trim().slice(0, 40) || undefined,
      });
    });
    return result;
  });
}

// ── Step 2: 통제된 시스템 프롬프트 — LLM은 셀렉터만 골라낸다, 액션 수행 금지 ──
const PLAN_TOOL = {
  name: "map_login_fields",
  description: "각 로그인 입력값을 정확히 매칭되는 DOM 요소의 qid로, 제출 버튼의 qid도 함께 지정한다",
  input_schema: {
    type: "object" as const,
    properties: {
      field_qids: {
        type: "array",
        items: { type: "number" },
        description: "입력된 필드 목록과 같은 순서로, 각 필드가 입력되어야 할 요소의 qid. 매칭되는 요소가 없으면 -1",
      },
      submit_qid: {
        type: "number",
        description: "로그인/제출 버튼 요소의 qid. 못 찾으면 -1",
      },
    },
    required: ["field_qids", "submit_qid"],
  },
};

async function planLoginSelectors(
  elements: DomElement[],
  fields: LoginField[]
): Promise<{ fieldQids: number[]; submitQid: number } | null> {
  const client = new Anthropic({ apiKey: resolveAnthropicKey() || undefined });

  const systemPrompt = [
    "당신은 웹페이지의 로그인 폼을 분석하는 역할만 수행합니다.",
    "직접 화면을 클릭하거나 텍스트를 입력하는 액션은 절대 수행하지 않습니다.",
    "제공된 DOM 요소 목록(JSON)을 분석하여, 주어진 각 입력값이 들어가야 할 요소의 qid와 로그인 제출 버튼의 qid만 찾아서 반환하십시오.",
    "추측하지 말고, 명확히 매칭되지 않으면 -1을 반환하십시오.",
  ].join("\n");

  const userMessage = [
    `DOM 요소 목록:\n${JSON.stringify(elements)}`,
    "",
    `입력해야 할 필드 목록 (순서대로):\n${fields.map((f, i) => `${i}. ${f.label}${f.isPassword ? " (비밀번호)" : ""}`).join("\n")}`,
  ].join("\n");

  try {
    const res = await client.messages.create({
      model: PLAN_MODEL,
      max_tokens: 500,
      system: systemPrompt,
      tools: [PLAN_TOOL],
      tool_choice: { type: "tool", name: "map_login_fields" },
      messages: [{ role: "user", content: userMessage }],
    });
    const toolBlock = res.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") return null;
    const input = toolBlock.input as { field_qids: number[]; submit_qid: number };
    return { fieldQids: input.field_qids, submitQid: input.submit_qid };
  } catch {
    return null;
  }
}

// ── Step 3: 룰베이스 실행 — AI 개입 없이 Playwright로 즉시 입력+클릭 ──
async function fillAndSubmit(
  page: Page,
  elements: DomElement[],
  fields: LoginField[],
  fieldQids: number[],
  submitQid: number
): Promise<void> {
  if (fieldQids.length !== fields.length || fieldQids.some((q) => q === -1)) {
    throw new Error("일부 입력 필드를 찾지 못했습니다.");
  }

  for (let i = 0; i < fields.length; i++) {
    const selector = `[data-qagent-id="${fieldQids[i]}"]`;
    await page.click(selector, { timeout: 5000 });
    await page.fill(selector, fields[i].value, { timeout: 5000 });
  }

  // 제출 버튼 클릭 — 못 찾으면 마지막 필드에서 Enter
  if (submitQid !== -1 && elements.some((el) => el.qid === submitQid)) {
    await page.click(`[data-qagent-id="${submitQid}"]`, { timeout: 5000 });
  } else {
    const lastSelector = `[data-qagent-id="${fieldQids[fieldQids.length - 1]}"]`;
    await page.press(lastSelector, "Enter");
  }
}

// ── 통합 함수 — Plan(LLM) → Execute(Playwright) 순서로 실행, 실패 시 비전 에이전트로 폴백 ──
export async function executeSmartLogin(
  page: Page,
  fields: LoginField[],
  onStep?: (step: VisionStep) => void,
  control?: RunControl
): Promise<VisionResult> {
  try {
    const elements = await extractLoginElements(page);
    onStep?.({ stepNum: 1, action: "analyze", thought: "DOM에서 입력 가능한 요소를 추출했습니다.", details: `요소 ${elements.length}개 발견` });

    const plan = await planLoginSelectors(elements, fields);
    if (!plan) throw new Error("LLM이 셀렉터를 반환하지 못했습니다.");

    const beforeUrl = page.url();
    await fillAndSubmit(page, elements, fields, plan.fieldQids, plan.submitQid);

    // URL이 변경될 때까지 대기 — 로그인 성공 시 반드시 페이지가 이동함
    try {
      await page.waitForURL((url) => url.toString() !== beforeUrl, { timeout: 8000 });
    } catch {
      throw new Error("로그인 후 페이지가 변경되지 않았습니다. 계정 정보가 올바른지 확인하세요.");
    }

    // URL이 바뀌었어도 다시 로그인 페이지로 redirect된 경우 체크
    const afterUrl = page.url();
    if (/login|signin|auth/i.test(afterUrl) && afterUrl === beforeUrl) {
      throw new Error("로그인에 실패했습니다. 계정 정보를 확인하세요.");
    }

    const doneStep: VisionStep = {
      stepNum: 2,
      thought: `로그인 완료 — ${afterUrl} 으로 이동됨`,
      action: "done",
      details: `${fields.length}개 필드 입력 + 제출 → 페이지 이동 확인`,
    };
    onStep?.(doneStep);

    return { success: true, steps: [doneStep] };
  } catch (err: any) {
    // 스마트 로그인 실패 — DOM 스냅샷 에이전트로 폴백 (비밀번호는 시크릿 토큰으로 보호)
    console.warn(`  [smart-login] 룰베이스 로그인 실패, DOM 에이전트로 전환: ${err.message}`);
    onStep?.({ stepNum: 2, action: "fallback", thought: `룰베이스 로그인 실패(${err.message}) — DOM 스냅샷 에이전트로 재시도합니다.`, details: "에이전트 전환" });

    const secrets: SecretField[] = fields.map((f, i) => ({
      token: `{{SECRET_${i}}}`,
      value: f.value,
      masked: f.isPassword ? "(비밀번호)" : f.value,
    }));

    const loginTask = [
      "[로그인 과업]",
      "아래 필드를 로그인 폼에 입력하고 제출하세요:",
      ...fields.map((f, i) => `${i + 1}. '${f.label || `필드${i + 1}`}' 필드에 {{SECRET_${i}}} 입력${f.isPassword ? " (비밀번호 필드)" : ""}`),
      `${fields.length + 1}. 로그인/제출 버튼 클릭 (없으면 마지막 필드에서 Enter)`,
      "",
      "로그인 후 URL이 변경되고 로그인 폼이 사라진 것을 확인한 뒤 done 하세요.",
      "URL이 그대로이거나 에러 메시지가 보이면 fail로 보고하세요.",
    ].join("\n");

    const result = await runAgentScenario(page, loginTask, {
      maxSteps: 12,
      secrets,
      onStep,
      control,
    });
    return result;
  }
}
