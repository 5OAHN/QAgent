/**
 * Label 스냅샷 개선 검증 (LLM 호출 없음)
 *
 * 목표: label 요소가 스냅샷에 포함되는지, 그리고 dblclick이 실제로 작동하는지 검증
 * 실행: npx ts-node --transpile-only test-label-snapshot.ts
 */
import { chromium } from "playwright";
import { snapshotPage, executeAction, createBrowserSession, AgentAction } from "./src/agent-executor";

async function main() {
  console.log("🧪 Label 스냅샷 + dblclick 통합 검증");
  console.log("═".repeat(60));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto("https://todomvc.com/examples/react/dist/", { waitUntil: "domcontentloaded" });

  const session = createBrowserSession(page);
  const results: string[] = [];
  const check = (ok: boolean, label: string, detail = "") => {
    const line = `${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`;
    results.push(line);
    if (!ok) process.exitCode = 1;
  };

  // ─────────────────────────────────────────────────────────────
  // [1] 초기 스냅샷 확인
  // ─────────────────────────────────────────────────────────────
  console.log("\n[1️⃣] 초기 상태 — 입력창 탐지");
  let snap = await snapshotPage(session.getPage());
  const input = snap.elements.find((e) => e.placeholder?.includes("What needs"));
  check(!!input, "입력창 탐지", `ref=${input?.ref}`);

  // ─────────────────────────────────────────────────────────────
  // [2] 항목 생성
  // ─────────────────────────────────────────────────────────────
  console.log("\n[2️⃣] 항목 생성 — fill + Enter");
  await executeAction(session, { action: "fill", ref: input!.ref, value: "테스트1", reasoning: "" } as AgentAction, []);
  await executeAction(session, { action: "press", value: "Enter", reasoning: "" } as AgentAction, []);

  snap = await snapshotPage(session.getPage());
  check(snap.pageText.includes("테스트1"), "항목이 목록에 추가됨");

  // ─────────────────────────────────────────────────────────────
  // [3] 스냅샷 분석 — label이 포함되는지 확인
  // ─────────────────────────────────────────────────────────────
  console.log("\n[3️⃣] 스냅샷 분석 — label 요소 검증");
  const labels = snap.elements.filter((e) => e.tag === "label");
  const testLabel = labels.find((e) => e.text === "테스트1");

  console.log(`  전체 label 개수: ${labels.length}`);
  if (labels.length > 0) {
    console.log(`  Label 목록:`);
    labels.forEach((l) => {
      console.log(`    - ref=${l.ref} text="${l.text}" ctx="${l.ctx}"`);
    });
  }

  check(!!testLabel, "테스트1 label이 스냅샷에 포함됨", `ref=${testLabel?.ref}`);

  // ─────────────────────────────────────────────────────────────
  // [4] dblclick 실행 — 편집 모드 진입
  // ─────────────────────────────────────────────────────────────
  if (testLabel) {
    console.log("\n[4️⃣] dblclick 실행 — 편집 모드 진입");
    const outcome = await executeAction(session,
      { action: "dblclick", ref: testLabel.ref, reasoning: "" } as AgentAction,
      []
    );
    check(outcome.ok, "dblclick 실행 성공", outcome.error || "");

    // 편집 모드 여부 확인
    snap = await snapshotPage(session.getPage());
    const editingCount = snap.elements.filter((e) => e.tag === "input" && e.type !== "checkbox").length;
    const hasEditing = snap.pageText.includes("editing") || editingCount > 1;
    check(hasEditing, "편집 모드 진입 확인", `input 요소 ${editingCount}개`);

    // 편집 input에 텍스트 입력
    if (editingCount > 1) {
      console.log("\n[5️⃣] 편집 텍스트 변경");
      const editInput = snap.elements.find((e) => e.tag === "input" && e.type !== "checkbox" && e.value !== "테스트1");
      if (editInput) {
        await executeAction(session,
          { action: "fill", ref: editInput.ref, value: "테스트1-수정됨", reasoning: "" } as AgentAction,
          []
        );
        await executeAction(session,
          { action: "press", value: "Enter", reasoning: "" } as AgentAction,
          []
        );

        snap = await snapshotPage(session.getPage());
        check(snap.pageText.includes("테스트1-수정됨"), "수정 내용 반영됨");
      }
    }
  } else {
    check(false, "테스트1 label을 찾을 수 없어 dblclick 스킵");
  }

  // ─────────────────────────────────────────────────────────────
  // 결과 출력
  // ─────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("📊 최종 결과");
  console.log("═".repeat(60));
  results.forEach((line) => console.log(line));

  await browser.close();
  process.exit(process.exitCode || 0);
}

main().catch((e) => {
  console.error("❌ 테스트 오류:", e.message);
  console.error(e.stack);
  process.exit(1);
});
