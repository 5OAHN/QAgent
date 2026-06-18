import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

// 실패 분석은 빠른 Sonnet, DSL 변환은 정확한 Opus 사용
const ANALYSIS_MODEL = "claude-sonnet-4-6";
const CONVERSION_MODEL = "claude-opus-4-7";

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다. worker/.env 파일에 키를 추가해 주세요.");
  }
  return new Anthropic();
}

// ── 실패 원인 분석 ────────────────────────────────────────────────────
export async function analyzeFailure(testCase: any, result: any): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return result.failReason;

  const client = getClient();
  const content: Anthropic.MessageParam["content"] = [
    {
      type: "text",
      text: [
        "QA 테스트 실패 원인을 간결하게 분석해줘 (3문장 이내).",
        `**시나리오**: ${testCase.scenario}`,
        `**기대 결과**: ${testCase.expected}`,
        `**에러**: ${result.failReason}`,
        `**콘솔 로그**:\n${result.consoleLogs.slice(-10).join("\n")}`,
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
      messages: [{ role: "user", content }],
    });
    const block = res.content[0];
    return block.type === "text" ? block.text : result.failReason;
  } catch {
    return result.failReason;
  }
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
  goto(URL)                       — navigate to a URL
  click(selector)                 — click an element
  input(selector, 'value')        — type into an input field
  wait(milliseconds)              — pause execution
  assert_visible(selector)        — verify element is visible
  assert_url(URL or partial URL)  — verify current URL contains string
  assert_text(selector, 'text')   — verify element contains text

Selector priority:
  1. Use element names from the provided list (they map to real CSS selectors)
  2. Fall back to CSS selectors (#id, .class, [attr=val], tag)

Rules:
  - Split logically distinct flows into separate test cases (N-001, N-002, …)
  - Each test case needs clear "actions" and an optional "expected" assertion
  - Keep feature and scenario in Korean`;

export async function convertNaturalLanguageToDSL(
  targetUrl: string,
  naturalText: string,
  pageNames: string[],
  elementNames: string[]
): Promise<GeneratedTestCase[]> {
  const client = getClient();

  const userMessage = [
    `Target URL: ${targetUrl}`,
    `Available page names: ${pageNames.length ? pageNames.join(", ") : "(none)"}`,
    `Available element names: ${elementNames.length ? elementNames.join(", ") : "(none)"}`,
    "",
    "Test scenario to convert:",
    naturalText,
  ].join("\n");

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

  const cases = (toolBlock.input as any).testCases as GeneratedTestCase[];
  if (!cases?.length) {
    throw new Error("생성된 테스트 케이스가 없습니다.");
  }

  return cases;
}
