// 기계 레이어 검증 스크립트 — LLM 없이 스냅샷/액션/새탭전환을 실제 브라우저로 검증
// Part A: 네이버 검색 + 링크 클릭 + 새 탭 전환
// Part B: SPA(TodoMVC)에서 입력/리스트/체크박스 조작 — SaaS 테스트와 동일한 패턴
import { chromium } from "playwright";
import { snapshotPage, createBrowserSession, executeAction, AgentAction } from "./src/agent-executor";

function assert(cond: boolean, label: string) {
  if (cond) console.log(`  ✅ ${label}`);
  else { console.error(`  ❌ FAIL: ${label}`); process.exitCode = 1; }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "ko-KR" });
  const page = await context.newPage();
  const session = createBrowserSession(page);

  const act = (a: Partial<AgentAction>) =>
    executeAction(session, { reasoning: "", ...a } as AgentAction, []);

  // ── Part A: 네이버 ──────────────────────────────────────────────
  console.log("\n[A1] 네이버 진입 + 스냅샷");
  await page.goto("https://naver.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  let snap = await snapshotPage(session.getPage());
  const searchInput = snap.elements.find((e) => e.tag === "input" && e.name === "query");
  assert(!!searchInput, `검색창 스냅샷에 존재 — ref=${searchInput?.ref}`);

  console.log("\n[A2] 검색어 입력 + Enter");
  let out = await act({ action: "fill", ref: searchInput!.ref, value: "브리메이" });
  assert(out.ok, "fill 성공");
  out = await act({ action: "press", value: "Enter" });
  assert(out.ok && out.urlAfter.includes("search.naver.com"), `검색 실행 → ${out.urlAfter.slice(0, 60)}`);

  console.log("\n[A3] 검색결과 스마트스토어 링크 (네이버가 세션별로 다른 결과를 주므로 정보성)");
  snap = await snapshotPage(session.getPage());
  const storeLink = snap.elements.find((e) => e.href?.includes("smartstore.naver.com"));
  console.log(storeLink ? `  ℹ️ 스마트스토어 링크 발견 — ref=${storeLink.ref}` : "  ℹ️ 이번 검색결과에는 스마트스토어 링크 없음 (네이버 응답 변동)");

  console.log("\n[A4] 새 탭(target=_blank) 자동 전환 — 결정적 검증");
  await session.getPage().setContent(
    `<a href="https://demo.playwright.dev/todomvc/" target="_blank">스토어 새 탭으로 열기</a>`
  );
  snap = await snapshotPage(session.getPage());
  const blankLink = snap.elements.find((e) => e.text?.includes("스토어 새 탭"));
  assert(!!blankLink, `target=_blank 링크 스냅샷에 존재 — ref=${blankLink?.ref}`);
  out = await act({ action: "click", ref: blankLink!.ref });
  assert(out.ok && out.newTab, `클릭 + 새 탭 전환 (newTab=${out.newTab})`);
  assert(out.urlAfter.includes("todomvc"), `새 탭 URL로 활성 페이지 전환됨: ${out.urlAfter.slice(0, 55)}`);

  console.log("\n[A5] 늦은 팝업이 goto를 가로채지 않는지 검증");
  out = await act({ action: "goto", value: "https://demo.playwright.dev/todomvc/" });
  assert(out.ok && out.urlAfter.includes("todomvc"), `goto 후 활성 페이지 유지: ${out.urlAfter.slice(0, 55)}`);

  // ── Part B: SPA 리스트/체크박스 조작 (SaaS 패턴) ────────────────
  console.log("\n[B1] TodoMVC(React SPA) 진입");
  out = await act({ action: "goto", value: "https://demo.playwright.dev/todomvc/" });
  assert(out.ok, "SPA 진입");
  snap = await snapshotPage(session.getPage());
  const todoInput = snap.elements.find((e) => e.placeholder?.includes("What needs"));
  assert(!!todoInput, `할일 입력창 스냅샷에 존재 — ref=${todoInput?.ref} ph="${todoInput?.placeholder}"`);

  console.log("\n[B2] 항목 2개 추가 (fill + Enter, SPA 재렌더링 후 ref 갱신 검증)");
  out = await act({ action: "fill", ref: todoInput!.ref, value: "상담 기록 1" });
  out = await act({ action: "press", value: "Enter" });
  assert(out.ok, "항목 1 추가");
  // SPA 재렌더링 후 새 스냅샷 — ref가 갱신되어야 함
  snap = await snapshotPage(session.getPage());
  const todoInput2 = snap.elements.find((e) => e.placeholder?.includes("What needs"));
  out = await act({ action: "fill", ref: todoInput2!.ref, value: "상담 기록 2" });
  out = await act({ action: "press", value: "Enter" });
  assert(out.ok, "항목 2 추가");

  console.log("\n[B3] 리스트 최상단 체크박스 클릭 — 사용자의 실제 시나리오 패턴");
  snap = await snapshotPage(session.getPage());
  const allCheckboxes = snap.elements.filter((e) => e.type === "checkbox");
  console.log(`  체크박스 스냅샷: ${allCheckboxes.map((c) => `ref=${c.ref} ctx="${c.ctx}" checked=${c.checked}`).join(" / ")}`);
  // ctx 문맥으로 항목 체크박스와 전체토글을 구분할 수 있어야 함 (에이전트가 하는 판단과 동일)
  const itemCheckboxes = allCheckboxes.filter((e) => e.ctx?.includes("상담 기록"));
  assert(itemCheckboxes.length === 2, `ctx 문맥으로 항목 체크박스 2개 식별 (전체토글과 구분됨)`);
  const firstCheckbox = itemCheckboxes.find((e) => e.ctx?.includes("상담 기록 1"));
  assert(!!firstCheckbox && firstCheckbox.checked === false, `"상담 기록 1" 체크박스 식별 + 초기 unchecked`);

  out = await act({ action: "click", ref: firstCheckbox!.ref });
  assert(out.ok, "최상단 체크박스 클릭 성공");

  snap = await snapshotPage(session.getPage());
  const after1 = snap.elements.find((e) => e.type === "checkbox" && e.ctx?.includes("상담 기록 1"));
  const after2 = snap.elements.find((e) => e.type === "checkbox" && e.ctx?.includes("상담 기록 2"));
  assert(after1?.checked === true, `"상담 기록 1" 클릭 후 checked=true`);
  assert(after2?.checked === false, `"상담 기록 2"는 여전히 unchecked (오클릭 없음)`);

  console.log("\n[B4] 스냅샷 pageText 검증 — 에이전트가 성공 증거를 직접 볼 수 있어야 함");
  snap = await snapshotPage(session.getPage());
  assert(snap.pageText.includes("1 item left"), `스냅샷 pageText에 "1 item left" 포함 (에이전트가 카운터를 읽을 수 있음)`);
  assert(snap.pageText.includes("상담 기록 1"), `스냅샷 pageText에 항목 텍스트 포함`);

  await browser.close();
  console.log(process.exitCode ? "\n❌ 일부 검증 실패" : "\n🎉 기계 레이어 전체 검증 통과");
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
