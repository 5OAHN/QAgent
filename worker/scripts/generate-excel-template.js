// 일회성 스크립트 — frontend/public/templates/qagent_template.xlsx 생성
// 실행: node worker/scripts/generate-excel-template.js
const XLSX = require("xlsx");
const path = require("path");

const SCENARIO_HEADERS = ["구분", "테스트ID", "기능", "시나리오", "입력값/동작 (DSL)", "기대결과"];
const SCENARIO_ROWS = [
  ["TC", "TC-001", "로그인", "올바른 계정으로 로그인하면 대시보드로 이동한다",
    "input_placeholder('아이디', 'tester') -> input_placeholder('비밀번호', 'pass1234') -> click_text('로그인')",
    "assert_url('/dashboard')"],
  ["TC", "TC-002", "검색", "검색창에 키워드를 입력하면 결과가 표시된다",
    "send_placeholder('검색어를 입력하세요', '청구서')",
    "assert_text_visible('검색 결과')"],
];

const GUIDE_HEADERS = ["명령어", "설명", "예시"];
const GUIDE_ROWS = [
  ["click_text", "화면에 보이는 텍스트로 클릭", "click_text('로그인')"],
  ["click_role", "ARIA 역할 + 이름으로 클릭", "click_role('button', '삭제')"],
  ["click_label", "라벨 텍스트로 클릭", "click_label('이용약관 동의')"],
  ["input_placeholder", "placeholder로 입력", "input_placeholder('이메일을 입력하세요', 'test@test.com')"],
  ["input_label", "라벨로 입력", "input_label('병원코드', 'H001')"],
  ["send_placeholder", "placeholder로 입력 후 Enter", "send_placeholder('질문을 입력해 주세요', '예약 신청')"],
  ["assert_text_visible", "텍스트가 화면에 보이는지 확인", "assert_text_visible('예약이 완료되었습니다')"],
  ["assert_url", "현재 URL에 문자열이 포함되는지 확인", "assert_url('/dashboard')"],
  ["wait", "지정한 밀리초만큼 대기", "wait(1000)"],
  ["goto", "등록된 페이지 또는 URL로 이동", "goto('대상URL')"],
];
const GUIDE_NOTE = [
  [],
  ["※ 여러 동작은 ' -> ' 로 이어서 작성하세요. 예) click_text('로그인') -> wait(500) -> assert_url('/home')"],
  ["※ 기대결과 컬럼은 assert로 시작하는 경우에만 검증으로 실행됩니다."],
];

const wb = XLSX.utils.book_new();

const scenarioSheet = XLSX.utils.aoa_to_sheet([SCENARIO_HEADERS, ...SCENARIO_ROWS]);
scenarioSheet["!cols"] = [
  { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 34 }, { wch: 50 }, { wch: 24 },
];
XLSX.utils.book_append_sheet(wb, scenarioSheet, "시나리오");

const guideSheet = XLSX.utils.aoa_to_sheet([GUIDE_HEADERS, ...GUIDE_ROWS, ...GUIDE_NOTE]);
guideSheet["!cols"] = [{ wch: 20 }, { wch: 32 }, { wch: 50 }];
XLSX.utils.book_append_sheet(wb, guideSheet, "DSL 가이드");

const outPath = path.resolve(__dirname, "../../frontend/public/templates/qagent_template.xlsx");
XLSX.writeFile(wb, outPath);
console.log(`✅ 템플릿 생성 완료 → ${outPath}`);
