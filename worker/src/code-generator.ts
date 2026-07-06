import Anthropic from "@anthropic-ai/sdk";
import { resolveAnthropicKey } from "./api-keys";
import { LoginConfig } from "./pipeline";

const MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `You are a Playwright test automation code generator for web QA testing.

## Output rules
- Output ONLY executable code body — no imports, no function wrappers, no markdown fences
- Every statement must be awaited
- Write inline comments in Korean explaining each step

## Selector priority (use in this order)
1. [data-testid="..."]  — most stable
2. page.getByRole('button', { name: '...' })  — for buttons/links
3. page.getByLabel('...')  — for form inputs
4. page.getByText('...')  — for visible text
5. page.locator('a[href*="keyword"]')  — for links by URL keyword
6. page.locator('a:has-text("...")')  — for links with nested HTML

## Navigation patterns
- After goto: await page.waitForLoadState('domcontentloaded')
- After click that changes page: await page.waitForLoadState('domcontentloaded')
- For search inputs: fill then page.keyboard.press('Enter')
- For modals/dialogs: await page.waitForSelector('.modal', {state:'visible'}) before interacting

## Verification
- End with an assertion: await page.waitForSelector('...', {state:'visible'}) or expect text to confirm success`;

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
