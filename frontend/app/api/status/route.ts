import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8001";

const DEMO_DATA = {
  runId: "demo",
  status: "completed",
  total: 4,
  passed: 3,
  failed: 1,
  createdAt: new Date().toISOString(),
  mode: "natural",
  targetUrl: "https://example.com",
  scenarios: "1. 로그인 페이지 접속 후 계정 정보 입력\n2. 대시보드 메인 화면 진입 확인\n3. 설정 메뉴 이동 및 프로필 수정\n4. 로그아웃 후 세션 종료 확인",
  cases: [
    {
      testId: "V-001",
      feature: "Vision 에이전트",
      scenario: "로그인 페이지 접속 후 계정 정보 입력",
      status: "Pass",
      failReason: "",
      videoUrl: "",
      screenshotUrl: "",
      consoleLogs: [
        "[Step 1] click 로그인 버튼 — 메인 페이지 상단에 로그인 버튼이 보입니다. 클릭하겠습니다.",
        "[Step 2] type 'test@example.com' — 이메일 입력 필드에 포커스가 맞춰졌습니다.",
        "[Step 3] type 'password123' — 비밀번호 필드를 클릭하고 입력합니다.",
        "[Step 4] click 로그인 제출 — 입력이 완료되어 로그인 버튼을 클릭합니다.",
        "[Step 5] done 로그인 성공 확인 완료 — 대시보드 화면이 표시되었습니다.",
        "✅ 로그인 플로우가 성공적으로 완료되었습니다.",
      ],
      suggestions: [
        { area: "로그인 폼", issue: "비밀번호 입력 시 강도 표시기가 없어 사용자가 보안 수준을 알 수 없습니다.", suggestion: "입력 필드 하단에 비밀번호 강도 바(약/보통/강)를 추가하면 보안 인식을 높일 수 있습니다." },
        { area: "에러 피드백", issue: "로그인 실패 시 에러 메시지가 상단에만 표시되어 입력 필드와 거리가 멀어 눈에 잘 안 띕니다.", suggestion: "각 입력 필드 바로 아래에 인라인 에러 메시지를 표시하는 방식으로 변경하세요." },
      ],
    },
    {
      testId: "V-002",
      feature: "Vision 에이전트",
      scenario: "대시보드 메인 화면 진입 확인",
      status: "Pass",
      failReason: "",
      videoUrl: "",
      screenshotUrl: "",
      consoleLogs: [
        "[Step 1] navigate 대시보드 URL로 이동 — 로그인 후 자동으로 대시보드가 표시됩니다.",
        "[Step 2] scroll down 300px — 전체 콘텐츠를 확인하기 위해 스크롤합니다.",
        "[Step 3] done 대시보드 화면 확인 완료 — 주요 위젯과 메뉴가 모두 표시되었습니다.",
        "✅ 대시보드 메인 화면이 정상 표시되었습니다.",
      ],
      suggestions: [],
    },
    {
      testId: "V-003",
      feature: "Vision 에이전트",
      scenario: "설정 메뉴 이동 및 프로필 수정",
      status: "Fail",
      failReason: "15단계 내에 프로필 저장 버튼을 찾지 못했습니다.",
      videoUrl: "",
      screenshotUrl: "",
      consoleLogs: [
        "[Step 1] click 설정 — 상단 내비게이션에서 설정 아이콘을 클릭합니다.",
        "[Step 2] click 프로필 편집 — 설정 페이지에서 프로필 편집 탭을 선택합니다.",
        "[Step 3] click 이름 입력 필드 — 이름 필드를 클릭하여 포커스를 줍니다.",
        "[Step 4] type '홍길동' — 이름을 입력합니다.",
        "[Step 5] failed 저장 버튼을 찾을 수 없음 — 저장 버튼이 화면에 보이지 않습니다.",
      ],
      suggestions: [
        { area: "설정 페이지", issue: "저장 버튼이 스크롤 아래에 숨겨져 있어 사용자가 변경 후 저장하지 않고 이탈할 가능성이 높습니다.", suggestion: "저장 버튼을 상단 고정 바(Sticky Header)에 배치하거나 변경 감지 시 플로팅 저장 버튼을 표시하세요." },
        { area: "피드백 부재", issue: "프로필 수정 후 변경 사항이 저장되었는지 확인할 수 있는 알림이 없습니다.", suggestion: "저장 성공 시 토스트 메시지를 3초간 표시하여 사용자에게 명확한 피드백을 제공하세요." },
        { area: "폼 레이아웃", issue: "필수 입력 항목과 선택 항목이 시각적으로 구분되지 않습니다.", suggestion: "필수 항목에 * 표시와 함께 섹션을 '기본 정보 / 추가 정보'로 나눠 구조를 명확히 하세요." },
      ],
    },
    {
      testId: "V-004",
      feature: "Vision 에이전트",
      scenario: "로그아웃 후 세션 종료 확인",
      status: "Pass",
      failReason: "",
      videoUrl: "",
      screenshotUrl: "",
      consoleLogs: [
        "[Step 1] click 프로필 아이콘 — 우측 상단 아바타를 클릭하여 드롭다운을 엽니다.",
        "[Step 2] click 로그아웃 — 드롭다운 메뉴에서 로그아웃을 선택합니다.",
        "[Step 3] done 로그아웃 완료 — 로그인 페이지로 리다이렉트되었습니다.",
        "✅ 세션이 정상 종료되었습니다.",
      ],
      suggestions: [],
    },
  ],
};

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("run_id");
  if (!runId) return NextResponse.json({ error: "run_id가 필요합니다." }, { status: 400 });

  // 데모 모드 — 워커 없이 mock 데이터 반환
  if (runId === "demo") {
    return NextResponse.json({ ...DEMO_DATA, createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString() });
  }

  try {
    const res = await fetch(`${WORKER_URL}/status/${runId}`);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: "Worker에 연결할 수 없습니다." }, { status: 503 });
  }
}
