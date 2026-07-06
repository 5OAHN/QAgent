import Anthropic from "@anthropic-ai/sdk";
import { Page, BrowserContext } from "playwright";
import { resolveAnthropicKey } from "./api-keys";

const AGENT_MODEL = "claude-haiku-4-5";

// ─────────────────────────────────────────────────────────────────────────────
// 공용 타입 — 프론트엔드 타임라인 포맷과 호환
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentStep {
  stepNum: number;
  thought: string;
  action: string;
  details: string;
}

export interface AgentResult {
  success: boolean;
  steps: AgentStep[];
  failReason?: string;
  summary?: string;
  totalTokens?: number;
  verificationStatus?: "approved" | "pending";
  reviewReason?: string;
}

export interface RunControl {
  isCancelled: () => boolean;
  isPaused: () => boolean;
}

/** 비밀번호 등 민감값 — LLM에는 토큰({{SECRET_0}})만 노출하고 실행 시점에 치환 */
export interface SecretField {
  token: string;   // 예: "{{SECRET_0}}"
  value: string;   // 실제 값
  masked: string;  // 로그 표기 (예: "(비밀번호)")
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM 스냅샷 — 화면의 상호작용 요소를 ref 번호와 함께 경량 추출
// ─────────────────────────────────────────────────────────────────────────────

export interface SnapshotElement {
  ref: string;
  tag: string;
  type?: string;
  role?: string;
  text?: string;
  name?: string;
  placeholder?: string;
  ariaLabel?: string;
  href?: string;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  inView?: boolean;
  /** 자체 텍스트가 없는 입력요소의 주변 문맥 (연관 label, 소속 행의 텍스트) */
  ctx?: string;
}

export interface PageSnapshot {
  url: string;
  title: string;
  elements: SnapshotElement[];
  truncated: boolean;
}

const MAX_ELEMENTS = 200;

export async function snapshotPage(page: Page): Promise<PageSnapshot> {
  // SPA 렌더링 대기 — 상호작용 요소가 하나라도 붙을 때까지 짧게 대기
  await page.waitForSelector("a, button, input, select, textarea, [role]", { timeout: 5000 }).catch(() => {});

  const raw = await page.evaluate((maxElements) => {
    const selector = [
      "a[href]", "button", "input", "select", "textarea", "summary",
      '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="radio"]',
      '[role="tab"]', '[role="menuitem"]', '[role="option"]', '[role="combobox"]',
      '[role="searchbox"]', '[role="textbox"]', '[role="switch"]',
      "[onclick]", "[contenteditable='true']",
    ].join(", ");

    const nodes = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    interface El {
      ref: string; tag: string; type?: string; role?: string; text?: string;
      name?: string; placeholder?: string; ariaLabel?: string; href?: string;
      value?: string; checked?: boolean; disabled?: boolean; inView?: boolean;
      ctx?: string;
    }
    const collected: El[] = [];
    let refCounter = 0;

    for (const el of nodes) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = window.getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;

      const ref = String(refCounter++);
      el.setAttribute("data-qagent-ref", ref);

      const input = el as HTMLInputElement;
      const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60) || undefined;
      let href: string | undefined;
      if (el.tagName === "A") {
        href = (el as HTMLAnchorElement).href.replace(/^https?:\/\//, "").slice(0, 70) || undefined;
        if (href && href.startsWith("javascript")) href = undefined;
      }
      const inView = rect.top < vh && rect.bottom > 0 && rect.left < vw && rect.right > 0;

      // 자체 텍스트가 없는 입력요소는 연관 label/소속 행 텍스트를 문맥으로 첨부.
      // 체크박스/라디오는 aria-label이 있어도 행마다 동일한 경우가 많아(예: "Toggle Todo")
      // 행 텍스트를 항상 첨부해 목록 내 위치를 구분할 수 있게 한다.
      let ctx: string | undefined;
      const isInput = ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName);
      const isToggle = input.type === "checkbox" || input.type === "radio";
      const lacksOwnLabel = !text && !el.getAttribute("aria-label") && !input.placeholder;
      if (isInput && (isToggle || lacksOwnLabel)) {
        if (el.id) {
          const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`) as HTMLElement | null;
          ctx = lbl?.innerText?.replace(/\s+/g, " ").trim().slice(0, 50) || undefined;
        }
        if (!ctx) {
          const wrapLabel = el.closest("label") as HTMLElement | null;
          ctx = wrapLabel?.innerText?.replace(/\s+/g, " ").trim().slice(0, 50) || undefined;
        }
        if (!ctx) {
          const row = el.closest('li, tr, [role="row"], [role="listitem"]') as HTMLElement | null;
          ctx = row?.innerText?.replace(/\s+/g, " ").trim().slice(0, 50) || undefined;
        }
      }

      collected.push({
        ref,
        tag: el.tagName.toLowerCase(),
        type: input.type && el.tagName === "INPUT" ? input.type : undefined,
        role: el.getAttribute("role") || undefined,
        text,
        name: input.name || undefined,
        placeholder: input.placeholder || undefined,
        ariaLabel: el.getAttribute("aria-label") || undefined,
        href,
        value: el.tagName === "INPUT" || el.tagName === "TEXTAREA"
          ? (input.type === "password" ? (input.value ? "(입력됨)" : "") : input.value.slice(0, 30)) || undefined
          : undefined,
        checked: input.type === "checkbox" || input.type === "radio" ? input.checked : undefined,
        disabled: input.disabled || undefined,
        inView: inView || undefined,
        ctx,
      });
    }

    // 요소가 너무 많으면 뷰포트 내 요소 우선으로 추리되, 문서 순서는 유지
    let result = collected;
    let truncated = false;
    if (collected.length > maxElements) {
      truncated = true;
      const inViewEls = collected.filter((e) => e.inView);
      if (inViewEls.length >= maxElements) {
        result = inViewEls.slice(0, maxElements);
      } else {
        const rest = collected.filter((e) => !e.inView).slice(0, maxElements - inViewEls.length);
        result = collected.filter((e) => inViewEls.includes(e) || rest.includes(e));
      }
    }

    return { elements: result, truncated };
  }, MAX_ELEMENTS);

  return {
    url: page.url(),
    title: await page.title().catch(() => ""),
    elements: raw.elements,
    truncated: raw.truncated,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 브라우저 세션 — 새 탭(팝업) 자동 전환 + 네이티브 다이얼로그 자동 수락
// ─────────────────────────────────────────────────────────────────────────────

export interface BrowserSession {
  getPage: () => Page;
  /** 액션 후 호출 — 새 탭이 열렸으면 활성 페이지를 전환하고 true 반환 */
  syncActivePage: () => Promise<boolean>;
  dispose: () => void;
}

export function createBrowserSession(initialPage: Page): BrowserSession {
  let activePage = initialPage;
  const context: BrowserContext = initialPage.context();
  const pendingPages: Page[] = [];

  const onPage = (p: Page) => { pendingPages.push(p); };
  context.on("page", onPage);

  const attachDialogHandler = (p: Page) => {
    p.on("dialog", (dialog) => { dialog.accept().catch(() => {}); });
  };
  attachDialogHandler(initialPage);

  return {
    getPage: () => activePage,
    syncActivePage: async () => {
      // 큐에 쌓인 새 페이지 중 마지막(가장 최근)으로 전환
      if (pendingPages.length === 0) return false;
      const newest = pendingPages[pendingPages.length - 1];
      pendingPages.length = 0;
      try {
        await newest.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
        if (newest.isClosed()) return false;
        attachDialogHandler(newest);
        activePage = newest;
        return true;
      } catch {
        return false;
      }
    },
    dispose: () => { context.off("page", onPage); },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 액션 정의 + 실행
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentAction {
  action: "click" | "fill" | "select" | "press" | "scroll" | "goto" | "wait" | "done" | "fail";
  ref?: string;
  value?: string;
  reasoning: string;
  evidence?: string;
}

const ACTION_TOOL = {
  name: "browser_action",
  description: "브라우저에서 수행할 다음 액션 하나를 결정한다",
  input_schema: {
    type: "object" as const,
    properties: {
      reasoning: {
        type: "string",
        description: "한국어로: 현재 상태 판단 + 이 액션을 선택한 이유 (1-2문장)",
      },
      action: {
        type: "string",
        enum: ["click", "fill", "select", "press", "scroll", "goto", "wait", "done", "fail"],
        description: "click=요소 클릭(자동 스크롤됨), fill=입력필드에 값 입력, select=드롭다운 옵션 선택, press=키보드 키 입력, scroll=페이지 스크롤(lazy 로딩 콘텐츠 노출용), goto=URL 직접 이동, wait=대기, done=시나리오 완료, fail=수행 불가 판정",
      },
      ref: { type: "string", description: "click/fill/select 대상 요소의 ref 번호. 스냅샷에 있는 ref만 사용" },
      value: {
        type: "string",
        description: "fill=입력할 텍스트, select=선택할 옵션 라벨, press=키 이름(Enter/Tab/Escape), scroll=down 또는 up, goto=절대 URL, wait=밀리초(최대 5000)",
      },
      evidence: {
        type: "string",
        description: "done/fail 전용 — 현재 스냅샷에서 완료(또는 불가)를 증명하는 구체적 근거 (URL, 화면의 텍스트 등)",
      },
    },
    required: ["reasoning", "action"],
  },
};

/** 리다이렉트 체인이 끝나 URL이 700ms 동안 그대로일 때까지 대기 (최대 6초) */
async function waitForUrlStable(page: Page, maxWaitMs = 6000): Promise<void> {
  const start = Date.now();
  let lastUrl = page.url();
  let stableSince = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await page.waitForTimeout(200);
    const current = page.url();
    if (current !== lastUrl) {
      lastUrl = current;
      stableSince = Date.now();
      await page.waitForLoadState("domcontentloaded", { timeout: 4000 }).catch(() => {});
    } else if (Date.now() - stableSince >= 700) {
      return;
    }
  }
}

interface ActionOutcome {
  ok: boolean;
  error?: string;
  urlBefore: string;
  urlAfter: string;
  newTab: boolean;
}

export async function executeAction(
  session: BrowserSession,
  act: AgentAction,
  secrets: SecretField[]
): Promise<ActionOutcome> {
  const page = session.getPage();
  const urlBefore = page.url();
  const sel = act.ref !== undefined ? `[data-qagent-ref="${act.ref}"]` : "";

  const substitute = (v: string): string => {
    let out = v;
    for (const s of secrets) out = out.split(s.token).join(s.value);
    return out;
  };

  try {
    switch (act.action) {
      case "click":
        if (!sel) throw new Error("ref가 필요합니다.");
        await page.locator(sel).first().click({ timeout: 8000 });
        break;
      case "fill": {
        if (!sel) throw new Error("ref가 필요합니다.");
        const realValue = substitute(act.value || "");
        await page.locator(sel).first().click({ timeout: 5000 }).catch(() => {});
        await page.locator(sel).first().fill(realValue, { timeout: 5000 });
        break;
      }
      case "select":
        if (!sel) throw new Error("ref가 필요합니다.");
        await page.locator(sel).first().selectOption({ label: act.value || "" }, { timeout: 5000 });
        break;
      case "press":
        await page.keyboard.press(act.value || "Enter");
        break;
      case "scroll":
        await page.mouse.wheel(0, act.value === "up" ? -600 : 600);
        await page.waitForTimeout(400);
        break;
      case "goto":
        await page.goto(act.value || "", { waitUntil: "domcontentloaded", timeout: 20000 });
        break;
      case "wait":
        await page.waitForTimeout(Math.min(parseInt(act.value || "1000", 10) || 1000, 5000));
        break;
    }

    // 액션 후 안정화 — 새 탭 감지 → 네비게이션 대기 → URL 안정화(리다이렉트 체인 추적)
    await page.waitForTimeout(500);
    const newTab = await session.syncActivePage();
    const after = session.getPage();
    await after.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
    await waitForUrlStable(after);

    return { ok: true, urlBefore, urlAfter: after.url(), newTab };
  } catch (err: any) {
    const newTab = await session.syncActivePage();
    return {
      ok: false,
      error: (err.message || String(err)).split("\n")[0].slice(0, 200),
      urlBefore,
      urlAfter: session.getPage().url(),
      newTab,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 에이전트 루프
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `당신은 실제 브라우저를 조작하는 시니어 QA 자동화 에이전트입니다.

매 턴마다 현재 페이지의 DOM 스냅샷(상호작용 가능한 요소 목록)을 받고, browser_action 도구로 다음 액션 하나를 결정합니다.

## 절대 규칙
1. ref는 반드시 현재 스냅샷에 존재하는 번호만 사용하세요. 추측하거나 만들어내지 마세요.
2. 클릭은 자동으로 해당 요소까지 스크롤됩니다. inView가 false여도 클릭할 수 있습니다.
3. scroll 액션은 무한스크롤/lazy 로딩 콘텐츠를 새로 불러올 때만 사용하세요. 요소 클릭을 위해 스크롤할 필요는 없습니다.
4. 검색: 검색 input에 fill한 다음 턴에 press Enter 하세요.
5. {{SECRET_N}} 형태의 토큰이 과업에 있으면 fill의 value에 토큰 그대로 넣으세요. 실행 시 실제 값으로 치환됩니다.

## 판단 규칙
- 같은 액션이 2번 연속 실패하면 다른 요소나 다른 방법을 시도하세요.
- "N번째 항목", "최상단 리스트" 같은 지시는 스냅샷의 문서 순서(ref 순서)를 참고해 판단하세요.
- 액션 결과의 URL 변화와 새 스냅샷을 근거로 이전 액션의 성공 여부를 판단하세요.
- 팝업/모달이 뜨면 스냅샷에 그 요소들이 나타납니다. 모달 내부 버튼을 우선 처리하세요.

## 완료 판정 (중요)
- done은 과업의 모든 단계가 실제로 완료된 것을 현재 스냅샷에서 확인했을 때만 사용하세요.
- evidence에 완료를 증명하는 구체적 근거(현재 URL, 화면에 보이는 텍스트)를 반드시 적으세요.
- 확인되지 않았는데 done 하지 마세요. 이는 가장 심각한 오류입니다.
- 로그인 벽, CAPTCHA, 권한 부족 등으로 진행 불가면 fail로 명확한 이유를 보고하세요.

reasoning은 항상 한국어로 작성하세요.`;

function formatSnapshot(snap: PageSnapshot): string {
  const lines = snap.elements.map((e) => {
    const parts = [`[${e.ref}]`, e.tag];
    if (e.type) parts.push(`type=${e.type}`);
    if (e.role) parts.push(`role=${e.role}`);
    if (e.name) parts.push(`name=${e.name}`);
    if (e.text) parts.push(`"${e.text}"`);
    if (e.placeholder) parts.push(`ph="${e.placeholder}"`);
    if (e.ariaLabel) parts.push(`aria="${e.ariaLabel}"`);
    if (e.href) parts.push(`href=${e.href}`);
    if (e.value) parts.push(`value="${e.value}"`);
    if (e.ctx) parts.push(`ctx="${e.ctx}"`);
    if (e.checked !== undefined) parts.push(e.checked ? "checked" : "unchecked");
    if (e.disabled) parts.push("disabled");
    if (!e.inView) parts.push("(화면밖)");
    return parts.join(" ");
  });
  return [
    `URL: ${snap.url}`,
    `제목: ${snap.title}`,
    `요소 ${snap.elements.length}개${snap.truncated ? " (일부 생략됨)" : ""}:`,
    ...lines,
  ].join("\n");
}

function describeAction(act: AgentAction, secrets: SecretField[]): string {
  let v = act.value || "";
  for (const s of secrets) v = v.split(s.token).join(s.masked);
  switch (act.action) {
    case "click": return `ref=${act.ref} 클릭`;
    case "fill": return `ref=${act.ref} 에 "${v}" 입력`;
    case "select": return `ref=${act.ref} 에서 "${v}" 선택`;
    case "press": return `${v || "Enter"} 키 입력`;
    case "scroll": return `${v === "up" ? "위로" : "아래로"} 스크롤`;
    case "goto": return `${v} 이동`;
    case "wait": return `${v}ms 대기`;
    case "done": return act.evidence || "완료";
    case "fail": return act.evidence || "실패";
    default: return "";
  }
}

export async function runAgentScenario(
  initialPage: Page,
  task: string,
  options?: {
    maxSteps?: number;
    secrets?: SecretField[];
    onStep?: (step: AgentStep) => void;
    control?: RunControl;
  }
): Promise<AgentResult & { finalPage: Page }> {
  const maxSteps = options?.maxSteps ?? 25;
  const secrets = options?.secrets ?? [];
  const onStep = options?.onStep;
  const control = options?.control;

  const apiKey = resolveAnthropicKey();
  if (!apiKey) {
    return {
      success: false, steps: [], finalPage: initialPage,
      failReason: "ANTHROPIC_API_KEY가 설정되지 않았습니다.",
    };
  }
  const client = new Anthropic({ apiKey });
  const session = createBrowserSession(initialPage);

  const steps: AgentStep[] = [];
  let totalTokens = 0;
  // 과거 턴은 요약 텍스트로 압축해 토큰을 절약한다
  const history: string[] = [];

  const emit = (action: string, details: string, thought: string) => {
    const step: AgentStep = { stepNum: steps.length + 1, action, details, thought };
    steps.push(step);
    onStep?.(step);
    return step;
  };

  try {
    for (let i = 0; i < maxSteps; i++) {
      if (control?.isCancelled()) {
        return { success: false, steps, totalTokens, finalPage: session.getPage(), failReason: "사용자에 의해 중지되었습니다." };
      }
      while (control?.isPaused()) {
        await new Promise((r) => setTimeout(r, 500));
        if (control?.isCancelled()) {
          return { success: false, steps, totalTokens, finalPage: session.getPage(), failReason: "사용자에 의해 중지되었습니다." };
        }
      }

      const page = session.getPage();
      const snap = await snapshotPage(page);

      const userMessage = [
        `## 과업\n${task}`,
        history.length ? `## 지금까지의 진행\n${history.join("\n")}` : "",
        `## 현재 페이지 스냅샷\n${formatSnapshot(snap)}`,
        `다음 액션 하나를 결정하세요. (${i + 1}/${maxSteps} 스텝)`,
      ].filter(Boolean).join("\n\n");

      const response = await client.messages.create({
        model: AGENT_MODEL,
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        tools: [ACTION_TOOL],
        tool_choice: { type: "tool", name: "browser_action" },
        messages: [{ role: "user", content: userMessage }],
      });

      totalTokens += (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

      const toolBlock = response.content.find((b) => b.type === "tool_use");
      if (!toolBlock || toolBlock.type !== "tool_use") {
        return { success: false, steps, totalTokens, finalPage: session.getPage(), failReason: "AI가 액션을 결정하지 못했습니다." };
      }
      const act = toolBlock.input as AgentAction;
      const desc = describeAction(act, secrets);
      emit(act.action, desc, act.reasoning || "");
      console.log(`  [agent ${i + 1}/${maxSteps}] ${act.action} ${desc}`);

      if (act.action === "done") {
        return {
          success: true, steps, totalTokens, finalPage: session.getPage(),
          summary: act.evidence || act.reasoning,
          verificationStatus: "approved",
          reviewReason: act.evidence,
        };
      }
      if (act.action === "fail") {
        return {
          success: false, steps, totalTokens, finalPage: session.getPage(),
          failReason: act.evidence || act.reasoning || "에이전트가 수행 불가로 판정했습니다.",
        };
      }

      const outcome = await executeAction(session, act, secrets);
      const urlChanged = outcome.urlBefore !== outcome.urlAfter;
      const resultNote = outcome.ok
        ? `성공${outcome.newTab ? " (새 탭으로 전환됨)" : ""}${urlChanged ? ` → ${outcome.urlAfter}` : ""}`
        : `실패: ${outcome.error}`;
      history.push(`${i + 1}. ${act.action} ${desc} → ${resultNote}`);

      if (!outcome.ok) {
        emit("error", outcome.error || "액션 실패", "다음 스냅샷을 보고 다른 방법을 시도합니다.");
      }
    }

    return {
      success: false, steps, totalTokens, finalPage: session.getPage(),
      failReason: `${maxSteps}스텝 내에 완료하지 못했습니다.`,
    };
  } finally {
    session.dispose();
  }
}
