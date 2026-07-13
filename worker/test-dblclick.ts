/**
 * dblclick 액션 + 무효 액션 방어 검증 스크립트 (LLM 호출 없음)
 * TodoMVC React에 대해 executeAction을 직접 구동해 CRUD의 U(더블클릭 편집)를 검증한다.
 * 실행: npx ts-node --transpile-only test-dblclick.ts
 */
import { chromium } from "playwright";
import { snapshotPage, executeAction, createBrowserSession, AgentAction } from "./src/agent-executor";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto("https://todomvc.com/examples/react/dist/", { waitUntil: "domcontentloaded" });
  const session = createBrowserSession(page);
  const results: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    results.push(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) process.exitCode = 1;
  };

  // 1) CREATE — 입력창에 fill + Enter
  let snap = await snapshotPage(session.getPage());
  const input = snap.elements.find((e) => e.placeholder?.includes("What needs"));
  check("입력창 탐지", !!input, `ref=${input?.ref}`);
  await executeAction(session, { action: "fill", ref: input!.ref, value: "테스트1", reasoning: "" } as AgentAction, []);
  await executeAction(session, { action: "press", value: "Enter", reasoning: "" } as AgentAction, []);
  snap = await snapshotPage(session.getPage());
  check("CREATE: '테스트1' 목록 표시", snap.pageText.includes("테스트1"));

  // 2) UPDATE — 항목 라벨 더블클릭 → 편집 input 등장 확인
  //    스냅샷은 상호작용 요소 위주라 label이 안 잡힐 수 있으므로 li 텍스트 기반으로 ref 탐색
  const label = snap.elements.find((e) => e.text === "테스트1" && e.tag !== "input")
    || snap.elements.find((e) => e.ctx?.includes("테스트1") && e.type === "checkbox");
  // label 요소가 스냅샷에 없으면 DOM에서 직접 data-qagent-ref를 붙여 테스트
  let dblOutcome;
  if (label && label.tag !== "input") {
    dblOutcome = await executeAction(session, { action: "dblclick", ref: label.ref, reasoning: "" } as AgentAction, []);
  } else {
    await session.getPage().evaluate(() => {
      const el = Array.from(document.querySelectorAll("li label")).find((n) => n.textContent === "테스트1");
      el?.setAttribute("data-qagent-ref", "9999");
    });
    dblOutcome = await executeAction(session, { action: "dblclick", ref: "9999", reasoning: "" } as AgentAction, []);
  }
  check("dblclick 실행 성공", dblOutcome.ok, dblOutcome.error);
  const editing = await session.getPage().locator("li.editing input, input.edit, li input.new-todo").count();
  check("UPDATE: 더블클릭으로 편집 모드 진입", editing > 0, `편집 input ${editing}개`);

  // 편집 텍스트 교체 후 Enter — dblclick 직후 편집 input에 포커스가 있으므로 전체선택 후 타이핑
  await session.getPage().keyboard.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  await session.getPage().keyboard.type("테스트1-수정됨");
  await session.getPage().keyboard.press("Enter");
  snap = await snapshotPage(session.getPage());
  check("UPDATE: '테스트1-수정됨' 반영", snap.pageText.includes("테스트1-수정됨"));

  // 3) 무효 액션 방어 — 미지의 액션은 ok:false + 명시적 에러여야 한다
  const bad = await executeAction(session, { action: "hover" as any, ref: "0", reasoning: "" }, []);
  check("무효 액션 → 명시적 실패", !bad.ok && (bad.error || "").includes("지원하지 않는"), bad.error);

  // 4) stale ref 방어 — DOM에 없는 ref는 풀 타임아웃(8초) 대기 없이 즉시, 교정 가능한 메시지로 실패
  const t0 = Date.now();
  const stale = await executeAction(session, { action: "click", ref: "4242", reasoning: "" } as AgentAction, []);
  const elapsed = Date.now() - t0;
  check(
    "stale ref → 즉시 명시적 실패",
    !stale.ok && (stale.error || "").includes("현재 DOM에 없습니다") && elapsed < 4000,
    `${elapsed}ms — ${stale.error}`
  );

  await browser.close();
  console.log("\n" + results.join("\n"));
}

main().catch((e) => { console.error("스크립트 오류:", e.message); process.exit(1); });
