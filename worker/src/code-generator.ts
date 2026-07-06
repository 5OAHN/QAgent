import Anthropic from "@anthropic-ai/sdk";
import { resolveAnthropicKey } from "./api-keys";
import { LoginConfig } from "./pipeline";

const MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `You are a Playwright automation code generator (NOT Playwright Test — just the Playwright library).

## CRITICAL: Forbidden functions
- NEVER use expect() — it does not exist in this runtime
- NEVER use test(), describe(), beforeEach() — this is not a test file
- NEVER use require() or import

## Output rules
- Output ONLY the async function body — no imports, no function wrappers, no markdown fences
- Every statement must be awaited
- Write inline comments in Korean

## Selector priority (use in this order)
1. [data-testid="..."]  — most stable
2. page.getByRole('button', { name: '...' })  — for buttons
3. page.getByRole('link', { name: '...' })  — for links
4. page.getByLabel('...')  — for form inputs
5. page.locator('input[name="..."]')  — for named inputs (e.g. naver search: input[name="query"])
6. page.locator('a[href*="keyword"]')  — for links by URL
7. page.locator('a:has-text("...")')  — for links with nested HTML
8. page.getByText('...')  — last resort

## Navigation & waiting
- After goto: await page.waitForLoadState('domcontentloaded')
- After click that may navigate: await page.waitForLoadState('domcontentloaded').catch(()=>{})
- For search: fill input then await page.keyboard.press('Enter')
- To wait for element: await page.waitForSelector('...', {state:'visible', timeout:10000})
- To verify success: await page.waitForSelector('...', {state:'visible'}) — NOT expect()

## Known selectors
- 네이버 검색창: input[name="query"]
- 구글 검색창: input[name="q"]`;

export async function generatePlaywrightCode(
  targetUrl: string,
  scenario: string,
  loginConfig?: LoginConfig
): Promise<{ code: string; tokens: number }> {
  const apiKey = resolveAnthropicKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");

  const client = new Anthropic({ apiKey });

  const loginNote = loginConfig?.fields.filter((f) => f.value.trim()).length
    ? `\n로그인 상태: 이미 로그인 완료됨 (${loginConfig.fields.map((f) => f.label || "필드").join(", ")} 입력됨)\n코드 시작 시점에 로그인된 페이지가 열려 있음.`
    : "";

  const userMessage = [
    `대상 URL: ${targetUrl}${loginNote}`,
    "",
    "수행할 시나리오:",
    scenario,
    "",
    "위 시나리오를 정확히 수행하는 Playwright 코드 본문만 출력하세요.",
  ].join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = response.content.find((b) => b.type === "text")?.text || "";
  // 마크다운 코드펜스 제거
  const code = raw.replace(/^```[\w]*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
  const tokens = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

  return { code, tokens };
}

export async function fixPlaywrightCode(
  originalCode: string,
  errorMessage: string,
  scenario: string
): Promise<{ code: string; tokens: number }> {
  const apiKey = resolveAnthropicKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");

  const client = new Anthropic({ apiKey });

  const userMessage = [
    "아래 Playwright 코드가 실행 중 에러가 발생했습니다.",
    "",
    "## 원래 시나리오",
    scenario,
    "",
    "## 실패한 코드",
    "```",
    originalCode,
    "```",
    "",
    "## 에러 메시지",
    errorMessage,
    "",
    "에러를 분석하고 수정된 코드 본문만 출력하세요. 셀렉터 전략을 바꾸거나 waitFor 조건을 추가하세요.",
  ].join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = response.content.find((b) => b.type === "text")?.text || "";
  const code = raw.replace(/^```[\w]*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
  const tokens = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

  return { code, tokens };
}
