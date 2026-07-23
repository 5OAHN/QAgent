import Anthropic from "@anthropic-ai/sdk";
import { resolveAnthropicKey } from "./api-keys";

// 시나리오 분해 오류는 이후 모든 단계 실행에 전파되므로 Haiku보다 신뢰도가 높은 모델을 사용한다.
const PLAN_MODEL = "claude-sonnet-5";

export interface PlannedStep {
  /** 수행할 사용자 행동 하나 (예: 할일 입력창에 "테스트 항목"을 입력하고 Enter) */
  action: string;
  /** 이 행동이 성공했음을 화면에서 확인하는 방법 (예: 목록에 "테스트 항목"이 표시됨) */
  verify: string;
}

export interface ScenarioPlan {
  /** proceed=실행 진행, blocked=실행 불가/보류 판정 */
  decision: "proceed" | "blocked";
  /** blocked일 때 — 왜 진행할 수 없는지, 시나리오를 어떻게 고치면 되는지 */
  blockReason?: string;
  /** proceed일 때 — 모호한 부분을 AI가 어떻게 해석했는지 선언 (투명성) */
  assumptions: string[];
  steps: PlannedStep[];
  tokens: number;
}

const PLAN_TOOL = {
  name: "plan_scenario",
  description: "자연어 QA 시나리오를 분석해 실행 가능 여부를 판정하고, 가능하면 실행 단계로 정규화한다",
  input_schema: {
    type: "object" as const,
    properties: {
      decision: {
        type: "string",
        enum: ["proceed", "blocked"],
        description: "proceed=브라우저 자동화로 테스트 가능, blocked=진행 불가(이유 필수)",
      },
      block_reason: {
        type: "string",
        description: "blocked일 때만 — 진행 불가 이유 + 시나리오를 어떻게 보완하면 되는지 구체적 안내. 한국어로.",
      },
      assumptions: {
        type: "array",
        items: { type: "string" },
        description: "시나리오의 모호한 부분을 해석한 가정 목록. 명확한 시나리오면 빈 배열. 예: '\"설정 메뉴\"는 상단 네비게이션의 설정 링크로 해석'",
      },
      steps: {
        type: "array",
        description: "proceed일 때 — 순서대로 실행할 단계 목록. blocked면 빈 배열",
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
    required: ["decision", "assumptions", "steps"],
  },
};

const SYSTEM_PROMPT = `당신은 시니어 QA 리드입니다. 비개발자가 작성한 자연어 테스트 시나리오를 받아 두 가지를 수행합니다:
(1) 브라우저 자동화 에이전트가 이 시나리오를 테스트할 수 있는지 판정
(2) 가능하다면 실행 단계 목록으로 정규화

## 판정 기준 — blocked로 판정해야 하는 경우
- 브라우저 UI 조작 범위를 벗어남: 이메일/SMS 수신 확인, 실제 결제 승인, 전화, 물리 장치, 타 시스템 데이터 검증
- 파괴적이거나 되돌릴 수 없는 실운영 행위가 명백함: 실제 고객 데이터 삭제, 실제 주문/결제 실행 (테스트 환경 명시가 없을 때)
- 검증 기준을 세울 수 없음: "빨라야 한다", "예뻐야 한다", "잘 되는지 확인" 같이 관찰 가능한 결과로 변환 불가능한 요구만 있는 경우
- 필수 정보 누락: 특정 계정/데이터가 반드시 필요한데 시나리오에 없음 (예: "관리자 계정으로 승인" — 관리자 로그인 정보 없음)
- blocked일 때 block_reason에 반드시 포함: ① 왜 불가한지 ② 시나리오를 어떻게 고치면 진행 가능한지

## 판정 시 주의 — 웬만하면 proceed
- 표현이 다소 모호해도 화면에서 합리적으로 해석 가능하면 proceed + assumptions에 해석을 선언
- "N번째 항목", "아무 제품이나" 같은 지시는 실행 가능 — 가정 선언 후 proceed
- 조건부 시나리오("~라면 ~한다")도 proceed — 단계의 action에 조건을 그대로 담으면 에이전트가 화면을 보고 판단

## 정규화 규칙 (proceed일 때)
1. 각 단계(action)는 하나의 사용자 행동 단위. 뭉쳐있으면 분해.
2. verify는 그 행동 직후 화면에서 관찰 가능한 결과 (표시되는 텍스트, URL 변화, 목록 변화 등).
3. 시나리오에 명시된 기대결과("~가 보이면 성공")는 해당 단계의 verify로 반영.
4. 기대결과가 없으면 자연스러운 결과를 추론해 verify 작성.
5. 순수 확인 단계는 action을 "화면에서 ~ 확인"으로.
6. 조건부 단계는 action에 조건을 포함: "장바구니가 비어있지 않다면 비우기 버튼 클릭 (비어있으면 이 단계는 통과로 간주)"
7. 보통 2~6단계. 시나리오에 없는 행동을 만들어내지 마세요.`;

export async function planScenario(
  naturalText: string,
  targetUrl: string,
  loginDone: boolean
): Promise<ScenarioPlan> {
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
    max_tokens: 2000,
    // forced tool_choice는 thinking과 함께 쓸 수 없다(400) — Sonnet 5는 생략 시 기본 adaptive라서 명시적으로 꺼야 한다.
    // 설치된 SDK(0.30.1)가 thinking 필드 타입을 아직 몰라 any로 우회 — API는 그대로 받는다.
    thinking: { type: "disabled" },
    system: SYSTEM_PROMPT,
    tools: [PLAN_TOOL],
    tool_choice: { type: "tool", name: "plan_scenario" },
    messages: [{ role: "user", content: userMessage }],
  } as any);

  const tokens = (res.usage?.input_tokens || 0) + (res.usage?.output_tokens || 0);
  const toolBlock = res.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("시나리오 분석에 실패했습니다.");
  }
  const input = toolBlock.input as {
    decision: "proceed" | "blocked";
    block_reason?: string;
    assumptions?: string[];
    steps?: PlannedStep[];
  };

  const steps = (input.steps || []).filter((s) => s.action?.trim());
  const decision = input.decision === "blocked" ? "blocked" : "proceed";

  if (decision === "proceed" && steps.length === 0) {
    // 모델이 proceed라면서 단계를 안 준 경우 — 스키마 불일치 방어
    return {
      decision: "blocked",
      blockReason: "시나리오에서 실행 가능한 단계를 추출하지 못했습니다. 시나리오를 행동 단위로 다시 작성해주세요. (예: 1. ~메뉴를 클릭한다 2. ~버튼을 클릭한다)",
      assumptions: [],
      steps: [],
      tokens,
    };
  }

  return {
    decision,
    blockReason: input.block_reason,
    assumptions: input.assumptions || [],
    steps,
    tokens,
  };
}
