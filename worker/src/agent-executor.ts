import Anthropic from "@anthropic-ai/sdk";
import { Page, BrowserContext } from "playwright";
import { resolveAnthropicKey } from "./api-keys";

// Haiku는 스텝 실패→재시도가 잦아 명목가보다 실질 비용이 높고 신뢰도가 낮았음(라이브 테스트로 확인).
// Sonnet 5는 입력 3배/출력 3배 비싸지만 첫 시도 성공률이 훨씬 높아 재시도 비용까지 고려하면 순비용은 비슷하거나 더 낮다.
const AGENT_MODEL = "claude-sonnet-5";

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
  /** 화면에 보이는 일반 텍스트 (카운터, 안내문, 에러 메시지 등 비상호작용 콘텐츠) */
  pageText: string;
}

const MAX_ELEMENTS = 200;

export async function snapshotPage(page: Page): Promise<PageSnapshot> {
  // SPA 렌더링 대기 — 상호작용 요소가 하나라도 붙을 때까지 짧게 대기
  await page.waitForSelector("a, button, input, select, textarea, [role]", { timeout: 5000 }).catch(() => {});

  const raw = await page.evaluate((maxElements) => {
    const selector = [
      "a[href]", "button", "input", "select", "textarea", "summary", "label",
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

    // 비상호작용 텍스트도 수집 — 카운터/안내문/에러 배너 등은 성공 판정의 핵심 근거
    const pageText = (document.body?.innerText || "").replace(/\n{2,}/g, "\n").trim().slice(0, 1500);

    return { elements: result, truncated, pageText };
  }, MAX_ELEMENTS);

  return {
    url: page.url(),
    title: await page.title().catch(() => ""),
    elements: raw.elements,
    truncated: raw.truncated,
    pageText: raw.pageText,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 브라우저 세션 — 새 탭(팝업) 자동 전환 + 네이티브 다이얼로그 자동 수락
// ─────────────────────────────────────────────────────────────────────────────

export interface BrowserSession {
  getPage: () => Page;
  /**
   * 액션 후 호출 — 새 탭이 열렸으면 활성 페이지를 전환하고 true 반환.
   * adopt=false면 대기 중인 새 탭을 무시하고 큐만 비운다
   * (goto/scroll 등 사용자 클릭이 아닌 액션이 이전 액션의 늦은 팝업에 가로채이지 않도록).
   */
  syncActivePage: (adopt?: boolean) => Promise<boolean>;
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
    syncActivePage: async (adopt: boolean = true) => {
      if (pendingPages.length === 0) return false;
      if (!adopt) {
        pendingPages.length = 0;
        return false;
      }
      // 큐에 쌓인 새 페이지 중 마지막(가장 최근)으로 전환
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
  action: "click" | "dblclick" | "hover" | "fill" | "select" | "press" | "scroll" | "goto" | "wait" | "done" | "fail";
  ref?: string;
  value?: string;
  reasoning: string;
  evidence?: string;
}

/** 모델 출력 검증용 — tool_choice로 도구 호출은 강제되지만 필드 누락이나
    enum 밖 값은 API가 항상 막아주지 않는다(특히 소형 모델). */
const VALID_ACTIONS = new Set<string>([
  "click", "dblclick", "hover", "fill", "select", "press", "scroll", "goto", "wait", "done", "fail",
]);

const ACTION_TOOL = {
  name: "browser_action",
  description: "브라우저에서 수행할 다음 액션 하나를 결정한다",
  input_schema: {
    type: "object" as const,
    properties: {
      reasoning: {
        type: "string",
        description: "한국어 1-2문장으로 짧게. 장문으로 쓰면 응답이 토큰 한도에서 잘려 action 필드가 유실되고 이 턴이 무효 처리됩니다.",
      },
      action: {
        type: "string",
        enum: ["click", "dblclick", "hover", "fill", "select", "press", "scroll", "goto", "wait", "done", "fail"],
        description: "click=요소 클릭(자동 스크롤됨), dblclick=요소 더블클릭(인라인 편집 모드 진입 등), hover=요소에 마우스 올리기(hover해야 나타나는 버튼·메뉴 표시용), fill=입력필드에 값 입력(기존 값은 자동으로 대체됨 — 미리 지울 필요 없음), select=드롭다운 옵션 선택, press=키보드 키 입력, scroll=페이지 스크롤(lazy 로딩 콘텐츠 노출용), goto=URL 직접 이동, wait=대기, done=시나리오 완료, fail=수행 불가 판정",
      },
      ref: { type: "string", description: "click/dblclick/hover/fill/select 대상 요소의 ref 번호. 스냅샷에 있는 ref만 사용" },
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

/** 일시적 API 오류(레이트리밋 429, 서버 5xx)는 지수 백오프로 재시도 —
    한 번의 API 히컵이 스텝 실패로 번지지 않게 한다 */
async function createWithRetry(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
  tries = 3
): Promise<Anthropic.Message> {
  let lastErr: any;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (err: any) {
      lastErr = err;
      const status = err?.status ?? 0;
      const retryable = status === 429 || status === 408 || status >= 500;
      if (!retryable || attempt === tries) throw err;
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  throw lastErr;
}

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

  // ref 요소가 DOM에서 사라졌으면(SPA 재렌더링으로 ref 무효화) 풀 타임아웃(5~8초)을
  // 기다리지 말고 즉시, 에이전트가 스스로 고칠 수 있는 메시지로 실패시킨다.
  const requireTarget = async () => {
    if (!sel) throw new Error("ref가 필요합니다.");
    if ((await page.locator(sel).count()) === 0) {
      throw new Error(`ref=${act.ref} 요소가 현재 DOM에 없습니다(화면이 갱신되어 ref가 무효화됨). 다음 스냅샷의 새 ref 번호로 다시 시도하세요.`);
    }
    return page.locator(sel).first();
  };

  try {
    switch (act.action) {
      case "click": {
        const target = await requireTarget();
        const visible = await target.isVisible().catch(() => false);
        if (!visible) {
          // hover해야 나타나는 컨트롤(행 hover 시 표시되는 삭제 버튼 등) —
          // 풀 타임아웃을 낭비하지 않고 소속 행에 실제 마우스를 올려 표시시킨 뒤 클릭한다.
          const box = await page.evaluate((s) => {
            const el = document.querySelector(s) as HTMLElement | null;
            const row = (el?.closest("li, tr, [role='row'], [role='listitem']") || el?.parentElement) as HTMLElement | null;
            row?.scrollIntoView({ block: "center" });
            const r = row?.getBoundingClientRect();
            return r && r.width > 0 ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
          }, sel);
          if (box) {
            await page.mouse.move(box.x, box.y);
            await page.waitForTimeout(250);
          }
          try {
            await target.click({ timeout: 3000 });
          } catch {
            // 그래도 클릭 불가면 DOM 이벤트로 직접 클릭 (마지막 수단)
            await target.evaluate((el) => (el as HTMLElement).click());
          }
        } else {
          await target.click({ timeout: 8000 });
        }
        break;
      }
      case "dblclick":
        await (await requireTarget()).dblclick({ timeout: 8000 });
        break;
      case "hover":
        await (await requireTarget()).hover({ timeout: 5000 });
        await page.waitForTimeout(300); // hover로 트리거되는 UI(메뉴·버튼)가 나타날 시간
        break;
      case "fill": {
        const target = await requireTarget();
        const realValue = substitute(act.value || "");
        try {
          await target.fill(realValue, { timeout: 5000 });
        } catch {
          // React 제어 컴포넌트 등에서 fill의 actionability 검사가 실패하는 경우 —
          // 실제 사용자와 동일하게 클릭 → 전체선택 → 타이핑으로 폴백한다.
          await target.click({ timeout: 3000 }).catch(() => {});
          await page.keyboard.press("ControlOrMeta+a").catch(() => {});
          await page.keyboard.type(realValue, { delay: 15 });
        }
        break;
      }
      case "select":
        await (await requireTarget()).selectOption({ label: act.value || "" }, { timeout: 5000 });
        break;
      case "press":
        // F5는 헤드리스에서 무동작 — 실제 리로드로 매핑
        if ((act.value || "").toUpperCase() === "F5") {
          await page.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
        } else {
          await page.keyboard.press(act.value || "Enter");
        }
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
      default:
        // 알 수 없는 액션이 조용히 "성공"으로 처리되면 에이전트가 진행됐다고 착각한다
        throw new Error(`지원하지 않는 액션입니다: ${act.action}`);
    }

    // 액션 후 안정화 — 새 탭 감지 → 네비게이션 대기 → URL 안정화(리다이렉트 체인 추적)
    // 탭 전환 채택은 사용자 상호작용(click/press)에서만 — goto/scroll이 늦은 팝업에 가로채이지 않도록
    const interactive = act.action === "click" || act.action === "dblclick" || act.action === "press";
    await page.waitForTimeout(interactive ? 800 : 300);
    const newTab = await session.syncActivePage(interactive);
    const after = session.getPage();
    await after.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
    await waitForUrlStable(after);

    return { ok: true, urlBefore, urlAfter: after.url(), newTab };
  } catch (err: any) {
    const newTab = await session.syncActivePage(act.action === "click" || act.action === "press");
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

매 턴마다 현재 페이지의 스냅샷을 받고, browser_action 도구로 다음 액션 하나를 결정합니다.
스냅샷은 두 부분입니다: "화면에 보이는 텍스트"(카운터·안내문·상태 메시지 등)와 "상호작용 요소 목록"(ref 번호 포함).

## 절대 규칙
1. ref는 반드시 **현재 턴 스냅샷**에 존재하는 번호만 사용하세요. ref는 매 턴 새로 매겨지므로 이전 턴의 ref는 무효입니다. 추측하거나 만들어내지 마세요.
2. click: 요소를 한 번 클릭. 자동으로 스크롤됨. inView=false여도 가능.
3. dblclick: 요소를 빠르게 두 번 클릭. 인라인 편집, 이름 변경 UI에서 사용.
   예: TodoMVC 목록 항목의 레이블을 dblclick하면 편집 input이 나타남.
4. fill: 입력필드의 **기존 값을 자동으로 지우고 대체**합니다. Control+A나 Delete로 미리 지우는 턴을 낭비하지 마세요. 값 교체는 fill 한 번이면 됩니다.
5. 스냅샷은 **스크롤 위치와 무관하게 페이지 전체의 요소**를 담습니다(화면 밖 요소는 "(화면밖)" 표시).
   따라서 스냅샷에 없는 요소는 스크롤해도 나타나지 않습니다. scroll은 무한스크롤/lazy 로딩 콘텐츠를 새로 불러올 때만 쓰세요.
6. **과업의 대상 요소가 스냅샷에 없으면** 요소를 찾아 헤매지 말고, 과업의 완료 조건이 이미 충족된 상태인지 "화면에 보이는 텍스트"에서 먼저 확인하세요.
   이전 시도나 앞 단계에서 이미 수행되어 대상이 사라진 것일 수 있습니다(예: 삭제 과업인데 항목이 이미 없음 = 이미 삭제됨). 충족이 확인되면 그 근거로 done 하세요.
7. 마우스를 올려야 나타나는 컨트롤(행 hover 시 표시되는 버튼·서브메뉴 등)이 의심되면 hover 액션으로 해당 행에 마우스를 올린 뒤 다음 턴 스냅샷을 확인하세요.
8. 검색: 검색 input에 fill한 다음 턴에 press Enter 하세요.
9. {{SECRET_N}} 형태의 토큰이 과업에 있으면 fill의 value에 토큰 그대로 넣으세요. 실행 시 실제 값으로 치환됩니다.
10. reasoning은 1-2문장으로 짧게. 장문 reasoning은 응답이 토큰 한도에서 잘려 그 턴이 무효 처리됩니다.

## 판단 규칙
- 같은 액션이 2번 연속 실패하면 다른 요소나 다른 방법을 시도하세요.
- "N번째 항목", "최상단 리스트" 같은 지시는 스냅샷의 문서 순서(ref 순서)를 참고해 판단하세요.
- 액션 결과의 URL 변화와 새 스냅샷을 근거로 이전 액션의 성공 여부를 판단하세요.
- 팝업/모달이 뜨면 스냅샷에 그 요소들이 나타납니다. 모달 내부 버튼을 우선 처리하세요.

## 완료 판정 (중요)
- done은 과업의 모든 단계가 실제로 완료된 것을 현재 스냅샷에서 확인했을 때만 사용하세요.
- "~가 표시되면 성공" 류의 조건은 "화면에 보이는 텍스트" 섹션에서 확인하세요.
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
    `### 화면에 보이는 텍스트`,
    snap.pageText || "(없음)",
    `### 상호작용 요소 ${snap.elements.length}개${snap.truncated ? " (일부 생략됨)" : ""}`,
    ...lines,
  ].join("\n");
}

function describeAction(act: AgentAction, secrets: SecretField[]): string {
  let v = act.value || "";
  for (const s of secrets) v = v.split(s.token).join(s.masked);
  switch (act.action) {
    case "click": return `ref=${act.ref} 클릭`;
    case "dblclick": return `ref=${act.ref} 더블클릭`;
    case "hover": return `ref=${act.ref} 에 마우스 올림`;
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
  let invalidOutputs = 0;
  let consecutiveActionFailures = 0;
  // 과거 턴은 요약 텍스트로 압축해 토큰을 절약한다
  const history: string[] = [];
  const recentSigs: string[] = [];

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

      // 스텝 예산이 거의 소진되면 탐색을 멈추고 판정을 강제 — "12스텝 소진" 류의
      // 결론 없는 실패 대신 현재 화면 기준으로 done/fail을 내리게 한다.
      const budgetWarning = i >= maxSteps - 2
        ? `⚠️ 남은 스텝이 ${maxSteps - i}개뿐입니다. 더 이상 탐색하지 말고, 현재 화면 텍스트를 근거로 완료 조건 충족 여부를 판정해 done 또는 fail을 결정하세요.`
        : "";

      const userMessage = [
        `## 과업\n${task}`,
        history.length ? `## 지금까지의 진행\n${history.join("\n")}` : "",
        `## 현재 페이지 스냅샷\n${formatSnapshot(snap)}`,
        [`다음 액션 하나를 결정하세요. (${i + 1}/${maxSteps} 스텝)`, budgetWarning].filter(Boolean).join("\n"),
      ].filter(Boolean).join("\n\n");

      const response = await createWithRetry(client, {
        model: AGENT_MODEL,
        max_tokens: 1024,
        // tool_choice로 특정 도구를 강제하는 요청은 thinking과 함께 쓸 수 없다(400) —
        // Sonnet 5는 thinking을 생략하면 기본 adaptive라서 명시적으로 꺼야 한다.
        // 설치된 SDK(0.30.1)가 thinking 필드 타입을 아직 몰라 any로 우회 — API는 그대로 받는다.
        thinking: { type: "disabled" },
        system: SYSTEM_PROMPT,
        tools: [ACTION_TOOL],
        tool_choice: { type: "tool", name: "browser_action" },
        messages: [{ role: "user", content: userMessage }],
      } as any);

      totalTokens += (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

      const toolBlock = response.content.find((b) => b.type === "tool_use");
      if (!toolBlock || toolBlock.type !== "tool_use") {
        return { success: false, steps, totalTokens, finalPage: session.getPage(), failReason: "AI가 액션을 결정하지 못했습니다." };
      }
      const act = toolBlock.input as AgentAction;

      // 모델 출력 검증 — action 누락/enum 밖 값이 그대로 흘러가면 로그 콜백
      // (step.action.toUpperCase 등)에서 TypeError가 나 런 전체가 죽는다.
      // 크래시 대신 교정 피드백을 히스토리에 넣고 다음 턴에서 스스로 고치게 한다.
      // 주요 원인은 장문 reasoning이 max_tokens에서 잘려 action이 유실되는 것.
      const truncated = response.stop_reason === "max_tokens";
      if (truncated || !act.action || !VALID_ACTIONS.has(act.action)) {
        invalidOutputs++;
        const got = truncated
          ? "응답이 토큰 한도에서 잘림"
          : act.action ? `지원하지 않는 액션 "${act.action}"` : "action 필드 누락";
        emit("error", `AI 출력 오류: ${got}`, "유효한 액션으로 다시 결정합니다.");
        history.push(
          `${i + 1}. (무효 출력: ${got}) → reasoning은 1-2문장으로 짧게 쓰고, action 필드에 click/dblclick/fill/select/press/scroll/goto/wait/done/fail 중 하나를 반드시 포함하세요.`
        );
        if (invalidOutputs >= 3) {
          return {
            success: false, steps, totalTokens, finalPage: session.getPage(),
            failReason: "AI가 유효한 액션을 3회 연속 결정하지 못했습니다. 시나리오를 더 단순한 행동 단위로 나눠보세요.",
          };
        }
        continue;
      }
      invalidOutputs = 0; // 유효한 출력이 나오면 리셋 — 산발적 잘림으로 긴 시나리오가 중단되지 않게

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

      // 루프 감지 — 진전 없는 반복 패턴을 잡아 방향 전환을 강제한다.
      // (1) 같은 액션 3회 연속  (2) up/down을 번갈아 하는 스크롤 배회
      //     — 스크롤은 방향이 바뀌면 시그니처가 달라져 (1)로는 잡히지 않는다 (실제 라이브 실패 사례)
      const sig = `${act.action}|${act.ref}|${act.value}`;
      recentSigs.push(sig);
      if (recentSigs.length > 4) recentSigs.shift();
      const identicalLoop = recentSigs.length >= 3 && recentSigs.slice(-3).every((s) => s === sig);
      const scrollLoop = recentSigs.length === 4 && recentSigs.every((s) => s.startsWith("scroll|"));
      if (identicalLoop) {
        history.push(`⚠️ 경고: 같은 액션을 3회 반복했습니다. 이 방법은 효과가 없습니다. 화면 텍스트를 다시 읽고 완전히 다른 접근을 하거나, 과업 달성이 불가능하다고 판단되면 fail로 보고하세요.`);
        recentSigs.length = 0;
      } else if (scrollLoop) {
        history.push(
          `⚠️ 경고: 스크롤만 4회 반복했습니다. 스냅샷은 스크롤 위치와 무관하게 페이지 전체 요소를 포함하므로, 스냅샷에 없는 요소는 스크롤해도 나타나지 않습니다. 지금 즉시: (1) 과업의 완료 조건이 이미 충족됐는지 "화면에 보이는 텍스트"에서 확인 → 충족이면 done, (2) 아니면 스크롤이 아닌 다른 액션으로 과업을 달성하거나 fail로 보고하세요.`
        );
        recentSigs.length = 0;
      }

      if (!outcome.ok) {
        consecutiveActionFailures++;
        emit("error", outcome.error || "액션 실패", "다음 스냅샷을 보고 다른 방법을 시도합니다.");
        // 액션이 계속 실패하면 같은 접근을 고집하지 않도록 명시적으로 방향 전환을 지시
        if (consecutiveActionFailures === 2) {
          history.push(
            `⚠️ 액션이 2회 연속 실패했습니다. 접근을 바꾸세요: (1) 반드시 최신 스냅샷의 ref로만 시도, (2) fill이 안 되면 click 후 press로 키보드 입력, (3) 대상 요소가 사라졌다면 이전 단계(예: 더블클릭으로 편집 모드 재진입)부터 다시 수행하세요.`
          );
        }
      } else {
        consecutiveActionFailures = 0;
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
