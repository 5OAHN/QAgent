// Mock data for testing the Result Detail Dashboard

export const mockRunData = {
  runId: "run_abc123def456",
  status: "completed" as const,
  paused: false,
  total: 5,
  passed: 3,
  failed: 2,
  createdAt: "2024-06-29T14:35:22.000Z",
  mode: "natural" as const,
  targetUrl: "https://example.com/app",
  scenarios: `로그인 페이지로 이동하여 유효한 자격증명으로 로그인한다.

---

로그인 후 대시보드에서 사용자 정보가 올바르게 표시되는지 확인한다.

---

프로필 페이지로 이동하여 사용자 정보를 업데이트한다.

---

설정 페이지에서 언어를 변경하고 저장한다.

---

로그아웃 버튼을 클릭하여 로그인 페이지로 돌아오는지 확인한다.`,
  loginStatus: "success" as const,
  loginFailReason: undefined,
  loginSteps: undefined,
  cases: [
    {
      testId: "V-001",
      feature: "Authentication",
      scenario:
        "로그인 페이지로 이동하여 유효한 자격증명으로 로그인한다.",
      status: "Pass" as const,
      failReason: "",
      videoUrl: "https://example.com/videos/test-001.mp4",
      screenshotUrl: "https://example.com/screenshots/test-001.png",
      consoleLogs: [
        "[Step 1] Navigate to login page — https://example.com/login",
        "[Step 2] Find username field — element found in 120ms",
        "[Step 3] Enter username — test@example.com entered",
        "[Step 4] Find password field — element found in 85ms",
        "[Step 5] Enter password — password entered",
        "[Step 6] Click login button — click success",
        "[Step 7] Wait for dashboard — loaded in 450ms",
        "[Step 8] Verify user profile — username displayed correctly ✅",
      ],
      verificationStatus: "approved" as const,
    },
    {
      testId: "V-002",
      feature: "Dashboard",
      scenario:
        "로그인 후 대시보드에서 사용자 정보가 올바르게 표시되는지 확인한다.",
      status: "Pass" as const,
      failReason: "",
      videoUrl: "",
      screenshotUrl: "",
      screenshotBase64: undefined,
      consoleLogs: [
        "[Step 1] Verify dashboard is loaded — page ready",
        "[Step 2] Check user profile section — element visible",
        "[Step 3] Verify profile name — 'John Doe' matches expected value ✅",
        "[Step 4] Verify email display — 'john@example.com' correct ✅",
      ],
      verificationStatus: "approved" as const,
    },
    {
      testId: "V-003",
      feature: "Profile Update",
      scenario: "프로필 페이지로 이동하여 사용자 정보를 업데이트한다.",
      status: "Fail" as const,
      failReason:
        "[CATEGORY:UI_BUG] 프로필 저장 버튼이 비활성화 상태로 남아있음",
      videoUrl: "",
      screenshotUrl: "",
      screenshotBase64:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      consoleLogs: [
        "[Step 1] Navigate to profile page — /profile loaded",
        "[Step 2] Find edit button — button found",
        "[Step 3] Click edit mode — edit form displayed",
        "[Step 4] Change name field — 'Jane Doe' entered",
        "[Step 5] Click save button — button remains disabled ❌",
        "[Step 6] Error detected — save functionality broken",
      ],
      verificationStatus: undefined,
    },
    {
      testId: "V-004",
      feature: "Settings",
      scenario: "설정 페이지에서 언어를 변경하고 저장한다.",
      status: "Fail" as const,
      failReason:
        "[CATEGORY:LOADING_DELAY] 언어 변경 후 페이지 로딩이 30초 이상 소요됨",
      videoUrl: "",
      screenshotUrl: "",
      consoleLogs: [
        "[Step 1] Navigate to settings — /settings loaded",
        "[Step 2] Find language selector — dropdown found",
        "[Step 3] Select Korean language — language changed",
        "[Step 4] Click save settings — request sent",
        "[Step 5] Wait for response — waiting... (10s)",
        "[Step 6] Still loading — waiting... (20s)",
        "[Step 7] Timeout — page load exceeded 30s timeout ❌",
      ],
      verificationStatus: "pending" as const,
    },
    {
      testId: "V-005",
      feature: "Logout",
      scenario:
        "로그아웃 버튼을 클릭하여 로그인 페이지로 돌아오는지 확인한다.",
      status: "Pass" as const,
      failReason: "",
      videoUrl: "",
      screenshotUrl: "",
      consoleLogs: [
        "[Step 1] Find logout button — button visible in header",
        "[Step 2] Click logout — click success",
        "[Step 3] Wait for redirect — redirecting to login page",
        "[Step 4] Verify login page — /login loaded ✅",
        "[Step 5] Verify session cleared — no user data in localStorage ✅",
      ],
      verificationStatus: "approved" as const,
    },
  ],
};

// Mock data for a failed run with login issues
export const mockRunDataWithLoginFailure = {
  runId: "run_xyz789abc",
  status: "failed" as const,
  paused: false,
  total: 3,
  passed: 0,
  failed: 3,
  createdAt: "2024-06-28T10:15:00.000Z",
  mode: "natural" as const,
  targetUrl: "https://example.com/app",
  scenarios: `로그인 페이지로 이동한다.

---

테스트 계정으로 로그인한다.

---

로그인 후 홈페이지가 로드되는지 확인한다.`,
  loginStatus: "fail" as const,
  loginFailReason:
    "계정 인증 서버에 연결할 수 없습니다 (Connection timeout)",
  loginSteps: [
    "로그인 페이지 접근 성공",
    "로그인 자격증명 입력 완료",
    "로그인 버튼 클릭",
    "인증 서버 요청 중 타임아웃 발생",
  ],
  cases: [
    {
      testId: "V-001",
      feature: "Login",
      scenario: "로그인 페이지로 이동한다.",
      status: "Pending" as const,
      failReason: "",
      videoUrl: "",
      screenshotUrl: "",
      consoleLogs: [],
      verificationStatus: undefined,
    },
    {
      testId: "V-002",
      feature: "Authentication",
      scenario: "테스트 계정으로 로그인한다.",
      status: "Pending" as const,
      failReason: "",
      videoUrl: "",
      screenshotUrl: "",
      consoleLogs: [],
      verificationStatus: undefined,
    },
    {
      testId: "V-003",
      feature: "Home",
      scenario: "로그인 후 홈페이지가 로드되는지 확인한다.",
      status: "Pending" as const,
      failReason: "",
      videoUrl: "",
      screenshotUrl: "",
      consoleLogs: [],
      verificationStatus: undefined,
    },
  ],
};
