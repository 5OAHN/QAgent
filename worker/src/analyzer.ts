import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

// 실패 분석은 빠른 Sonnet, DSL 변환은 정확한 Opus 사용
const ANALYSIS_MODEL = "claude-haiku-4-5";
const CONVERSION_MODEL = "claude-haiku-4-5";

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다. worker/.env 파일에 키를 추가해 주세요.");
  }
  return new Anthropic();
}

export type FailCategory = "UI_BUG" | "LOADING_DELAY" | "SCENARIO_ERROR" | "SERVER_ERROR";

export interface FailAnalysis {
  category: FailCategory;
  reason: string;
}

const CATEGORY_LABELS: Record<FailCategory, string> = {
  UI_BUG:         "UI 버그",
  LOADING_DELAY:  "로딩 지연",
  SCENARIO_ERROR: "시나리오 오류",
  SERVER_ERROR:   "서버 에러",
};

const FAIL_ANALYSIS_TOOL = {
  name: "classify_failure",
  description: "Classify the QA test failure into a category and provide a concise reason",
  input_schema: {
    type: "object" as const,
    properties: {
      category: {
        type: "string",
        enum: ["UI_BUG", "LOADING_DELAY", "SCENARIO_ERROR", "SERVER_ERROR"],
        description: "UI_BUG=요소없음/레이아웃오류, LOADING_DELAY=타임아웃/응답없음, SCENARIO_ERROR=잘못된시나리오, SERVER_ERROR=서버500/네트워크오류",
      },
      reason: { type: "string", description: "3문장 이내 실패 원인 분석 (한국어)" },
    },
    required: ["category", "reason"],
  },
};

// ── 실패 원인 분석 ────────────────────────────────────────────────────
export async function analyzeFailure(testCase: any, result: any): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return result.failReason;

  const client = getClient();
  const content: Anthropic.MessageParam["content"] = [
    {
      type: "text",
      text: [
        "QA 테스트 실패 원인을 분석하고 카테고리를 분류해줘.",
        `**시나리오**: ${testCase.scenario}`,
        `**기대 결과**: ${testCase.expected || "(없음)"}`,
        `**에러**: ${result.failReason}`,
        `**콘솔 로그**:\n${(result.consoleLogs ?? []).slice(-10).join("\n")}`,
      ].join("\n"),
    },
  ];

  // 스크린샷 첨부
  if (result.screenshotUrl) {
    const localPath = result.screenshotUrl
      .replace(`${process.env.WORKER_BASE_URL || "http://localhost:8001"}/data/`, "")
      .replace(/\//g, require("path").sep);
    const absPath = require("path").resolve("data", localPath);
    if (fs.existsSync(absPath)) {
      const b64 = fs.readFileSync(absPath).toString("base64");
      content.push({
        type: "image",
        source: { type: "base64", media_type: "image/png", data: b64 },
      });
    }
  }

  try {
    const res = await client.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 400,
      tools: [FAIL_ANALYSIS_TOOL],
      tool_choice: { type: "tool", name: "classify_failure" },
      messages: [{ role: "user", content }],
    });
    const toolBlock = res.content.find((b) => b.type === "tool_use");
    if (toolBlock && toolBlock.type === "tool_use") {
      const inp = toolBlock.input as FailAnalysis;
      // category를 JSON 태그로 앞에 붙여 저장 — 프론트에서 파싱
      return `[CATEGORY:${inp.category}] ${inp.reason}`;
    }
    return result.failReason;
  } catch {
    return result.failReason;
  }
}

/** failReason 문자열에서 category + 순수 reason을 분리 */
export function parseFailAnalysis(failReason: string): { category: FailCategory | null; label: string | null; reason: string } {
  const match = failReason?.match(/^\[CATEGORY:(\w+)\]\s*/);
  if (match) {
    const category = match[1] as FailCategory;
    return { category, label: CATEGORY_LABELS[category] ?? null, reason: failReason.slice(match[0].length) };
  }
  return { category: null, label: null, reason: failReason };
}

// ── 자연어 → DSL 변환 (Tool Use로 구조화 출력 보장) ──────────────────
export interface GeneratedTestCase {
  testId: string;
  feature: string;
  scenario: string;
  actions: string;
  expected: string;
}

const SYSTEM_PROMPT = `You are a QA automation expert. Convert natural language test steps into our DSL format.

DSL Commands (joined with " -> "):

  [PREFERRED — Semantic locators, use these first]
  click_text('visible text')                 — click element by its visible text
  click_role('role', 'name')                 — click by ARIA role + name (roles: button, link, menuitem, tab, option, checkbox, radio)
  input_placeholder('placeholder', 'value')  — fill input by placeholder text
  input_label('label text', 'value')         — fill input by label text
  send_placeholder('placeholder', 'value')   — fill chat/search input by placeholder + press Enter
  assert_text_visible('text')                — verify text is visible on page
  assert_url(URL or partial URL)             — verify current URL contains string
  goto(URL)                                  — navigate to a URL
  wait(milliseconds)                         — pause execution

  [FALLBACK — only when semantic locators cannot work]
  click(elementName)               — click by registered element name
  input(elementName, 'value')      — fill by registered element name
  send(elementName, 'value')       — fill + Enter by registered element name

Rules:
  - ALWAYS prefer semantic locators (click_text, click_role, input_placeholder, etc.)
  - NEVER guess CSS selectors like .class, #id, [attr=val] — they break easily
  - For chat/search inputs: use send_placeholder('placeholder text', 'message')
  - For buttons/menus/links: use click_text('label') or click_role('button', 'label')
  - For form inputs with placeholder: use input_placeholder('placeholder', 'value')
  - For form inputs with label: use input_label('label text', 'value')
  - Split logically distinct flows into separate test cases (N-001, N-002, …)
  - The input may be free-form text, bullet points, numbered steps, or plain sentences — handle all formats
  - Keep feature and scenario in Korean`;

export async function convertNaturalLanguageToDSL(
  targetUrl: string,
  naturalText: string,
  pageNames: string[],
  elementNames: string[],
  domElements?: string
): Promise<GeneratedTestCase[]> {
  const client = getClient();

  const userMessage = [
    `Target URL: ${targetUrl}`,
    `Available page names: ${pageNames.length ? pageNames.join(", ") : "(none)"}`,
    `Available element names (registered): ${elementNames.length ? elementNames.join(", ") : "(none)"}`,
    "",
    domElements
      ? `Actual page elements extracted from ${targetUrl}:\n${domElements}\n\nUse the selectors above when registered element names are not available.`
      : "",
    "Test scenario to convert:",
    naturalText,
  ].filter(Boolean).join("\n");

  const res = await client.messages.create({
    model: CONVERSION_MODEL,
    max_tokens: 2000,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // 시스템 프롬프트는 항상 동일 → 프롬프트 캐싱으로 비용 절감
        cache_control: { type: "ephemeral" },
      },
    ] as any,
    tools: [
      {
        name: "generate_test_cases",
        description: "Generate structured QA test cases from natural language",
        input_schema: {
          type: "object" as const,
          properties: {
            testCases: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  testId:   { type: "string", description: "e.g. N-001" },
                  feature:  { type: "string", description: "Short feature name in Korean" },
                  scenario: { type: "string", description: "What this test verifies in Korean" },
                  actions:  { type: "string", description: "DSL action string" },
                  expected: { type: "string", description: "DSL assertion string, empty if none" },
                },
                required: ["testId", "feature", "scenario", "actions", "expected"],
              },
            },
          },
          required: ["testCases"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "generate_test_cases" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolBlock = res.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Claude가 테스트 케이스를 생성하지 못했습니다. 시나리오를 더 구체적으로 작성해 주세요.");
  }

  const raw = (toolBlock.input as any).testCases;
  const cases: GeneratedTestCase[] = Array.isArray(raw) ? raw : [];
  if (!cases.length) {
    throw new Error("생성된 테스트 케이스가 없습니다.");
  }

  return cases;
}
