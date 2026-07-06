import Anthropic from "@anthropic-ai/sdk";
import { resolveAnthropicKey } from "./api-keys";

const PLAN_MODEL = "claude-haiku-4-5";

export interface PlannedStep {
  /** 수행할 사용자 행동 하나 (예: 할일 입력창에 "테스트 항목"을 입력하고 Enter) */
  action: string;
  /** 이 행동이 성공했음을 화면에서 확인하는 방법 (예: 목록에 "테스트 항목"이 표시됨) */
  verify: string;
}

const PLAN_TOOL = {
  name: "plan_scenario",
  description: "자연어 QA 시나리오를 실행 가능한 단계 목록으로 정규화한다",
  input_schema: {
    type: "object" as const,
    properties: {
      steps: {
        type: "array",
        description: "순서대로 실행할 단계 목록",
        items: {
          type: "object",
          properties: {
            action: {
              type: "string",
              description: "수행할 사용자 행동 하나. 클릭/입력/이동 등 단일 행동 단위로 분해. 한국어로.",
            },
            verify: {
              type: "string",
              description: "이 행동의 성공을 화면에서 확인할 수 있는 관찰 가능한 결과. 시나리오에 기대결과가 명시됐으면 그것을, 없으면 행동의 자연스러운 결과를 추론해서 작성. 한국어로.",
            },
          },
          required: ["action", "verify"],
        },
      },
    },
    required: ["steps"],
  },
};

const SYSTEM_PROMPT = `당신은 시니어 QA 엔지니어입니다. 비개발자가 작성한 자연어 테스트 시나리오를 브라우저 자동화 에이전트가 실행할 수 있는 단계 목록으로 정규화합니다.

## 규칙
1. 각 단계(action)는 하나의 사용자 행동 단위입니다. 여러 행동이 뭉쳐있으면 분해하세요.
   - "로그인하고 대시보드 진입" → 두 단계가 아니라, 로그인이 이미 완료된 상태라면 "대시보드 메뉴 클릭" 하나로.
2. verify는 그 행동 직후 화면에서 관찰 가능한 결과여야 합니다 (표시되는 텍스트, URL 변화, 목록 변화 등).
3. 시나리오에 "~가 보이면 성공", "~를 확인한다" 같은 기대결과가 있으면 해당 단계의 verify로 반영하세요.
4. 기대결과가 없으면 행동의 자연스러운 결과를 추론해 verify를 작성하세요. 추측이 어려우면 "다음 화면으로 진행됨" 수준으로.
5. 순수 확인 단계("~가 표시되는지 확인")는 action을 "화면에서 ~ 확인"으로, verify를 그 내용으로 작성하세요.
6. 단계를 불필요하게 잘게 쪼개지 마세요. 보통 시나리오 하나는 2~6단계입니다.
7. 시나리오에 없는 행동을 만들어내지 마세요.`;

export async function planScenario(
  naturalText: string,
  targetUrl: string,
  loginDone: boolean
): Promise<{ steps: PlannedStep[]; tokens: number }> {
  const apiKey = resolveAnthropicKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
  const client = new Anthropic({ apiKey });

  const userMessage = [
    `대상 서비스: ${targetUrl}`,
    loginDone ? "전제: 로그인이 이미 완료된 상태에서 시작합니다." : "전제: 로그인 없이 시작합니다.",
    "",
    "테스트 시나리오:",
    naturalText,
  ].join("\n");

  const res = await client.messages.create({
    model: PLAN_MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    tools: [PLAN_TOOL],
    tool_choice: { type: "tool", name: "plan_scenario" },
    messages: [{ role: "user", content: userMessage }],
  });

  const tokens = (res.usage?.input_tokens || 0) + (res.usage?.output_tokens || 0);
  const toolBlock = res.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("시나리오 분석에 실패했습니다.");
  }
  const input = toolBlock.input as { steps: PlannedStep[] };
  const steps = (input.steps || []).filter((s) => s.action?.trim());
  if (steps.length === 0) throw new Error("시나리오에서 실행 가능한 단계를 찾지 못했습니다.");
  return { steps, tokens };
}
