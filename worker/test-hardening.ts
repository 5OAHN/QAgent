/**
 * V-001 단계 7 라이브 실패(스크롤 배회로 12스텝 소진)에 대한 방어 검증 — LLM 없이 실행 계층만 테스트.
 *
 * 검증 항목:
 *  1. TodoMVC 삭제 버튼이 스냅샷에 aria-label과 함께 노출되는가
 *  2. executeAction click으로 삭제가 실제로 동작하는가 (완료 항목 삭제 → 빈 목록)
 *  3. hover 액션 — hover해야 나타나는 버튼을 표시시킨 뒤 클릭 가능한가 (합성 페이지)
 *  4. 숨겨진 요소 click 시 자동 hover 폴백 — hover 없이 바로 click해도 성공하는가
 *  5. 삭제 후 pageText에 항목이 없음 — "이미 완료됨" 판정의 근거가 되는 텍스트 확인
 */
import { chromium } from "playwright";
import { snapshotPage, executeAction, createBrowserSession } from "./src/agent-executor";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? passed++ : failed++;
}

// hover해야 삭제 버튼이 나타나는 합성 페이지 (Notion/Jira류 행 UI 재현)
const HOVER_PAGE = `data:text/html;charset=utf-8,${encodeURIComponent(`
<!DOCTYPE html><html><head><style>
  li .del { display: none; }
  li:hover .del { display: inline-block; }
</style></head><body>
<ul>
  <li id="row1"><label>항목 하나</label> <button class="del" onclick="this.closest('li').remove()">X</button></li>
  <li id="row2"><label>항목 둘</label> <button class="del" onclick="this.closest('li').remove()">X</button></li>
</ul>
</body></html>`)}`;

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── 1~2, 5: TodoMVC 실전 삭제 플로우 ──────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto("https://todomvc.com/examples/react/dist/", { waitUntil: "domcontentloaded" });
    await page.fill(".new-todo", "구매하기-긴급");
    await page.keyboard.press("Enter");
    await page.click(".toggle");
    await page.waitForTimeout(300);

    const snap = await snapshotPage(page);
    const delBtn = snap.elements.find((e) => e.tag === "button" && (e.ariaLabel || "").toLowerCase().includes("delete"));
    check("1. 삭제 버튼이 스냅샷에 노출", !!delBtn, delBtn ? `[${delBtn.ref}] aria="${delBtn.ariaLabel}"` : "스냅샷에 없음");

    const session = createBrowserSession(page);
    const outcome = await executeAction(session, { action: "click", ref: delBtn!.ref, reasoning: "" }, []);
    await page.waitForTimeout(300);
    const after = await snapshotPage(page);
    const itemGone = !after.pageText.includes("구매하기-긴급");
    check("2. executeAction click으로 삭제 성공", outcome.ok && itemGone, outcome.ok ? "항목 제거됨" : outcome.error);
    check("5. 삭제 후 pageText에 항목 없음 (완료 판정 근거)", itemGone && !after.pageText.includes("item left"));
    session.dispose();
    await page.close();
  }

  // ── 3: hover 액션으로 숨김 버튼 표시 ──────────────────────────────
  {
    const page = await browser.newPage();
    await page.goto(HOVER_PAGE);
    const session = createBrowserSession(page);

    const before = await snapshotPage(page);
    const hiddenBtn = before.elements.find((e) => e.text === "X");
    check("3a. hover 전엔 X 버튼이 스냅샷에 없음", !hiddenBtn);

    const rowEl = before.elements.find((e) => (e.text || "").includes("항목 하나"));
    check("3b. 행의 label이 스냅샷에 있음 (hover 대상)", !!rowEl, rowEl ? `[${rowEl.ref}] "${rowEl.text}"` : "");

    const hoverOut = await executeAction(session, { action: "hover", ref: rowEl!.ref, reasoning: "" }, []);
    const snap3 = await snapshotPage(page);
    const revealed = snap3.elements.find((e) => e.text === "X");
    check("3c. hover 후 X 버튼이 스냅샷에 나타남", hoverOut.ok && !!revealed, revealed ? `[${revealed.ref}]` : hoverOut.error);

    const clickOut = await executeAction(session, { action: "click", ref: revealed!.ref, reasoning: "" }, []);
    const gone = !(await page.locator("#row1").count());
    check("3d. 표시된 X 클릭으로 행 삭제", clickOut.ok && gone);
    session.dispose();
    await page.close();
  }

  // ── 4: hover 없이 숨김 요소를 바로 click → 자동 hover 폴백 ─────────
  {
    const page = await browser.newPage();
    await page.goto(HOVER_PAGE);
    const session = createBrowserSession(page);

    // 숨김 버튼에 ref를 강제로 부여해 "이전 턴 스냅샷엔 없지만 DOM엔 존재하는" 상황 재현
    await page.evaluate(() => {
      const btn = document.querySelector("#row2 .del") as HTMLElement;
      btn.setAttribute("data-qagent-ref", "99");
    });
    const out = await executeAction(session, { action: "click", ref: "99", reasoning: "" }, []);
    const gone = !(await page.locator("#row2").count());
    check("4. 숨김 버튼 직접 click → 자동 hover 폴백으로 성공", out.ok && gone, out.ok ? "" : out.error);
    session.dispose();
    await page.close();
  }

  await browser.close();
  console.log(`\n결과: ${passed}/${passed + failed} 통과`);
  process.exit(failed ? 1 : 0);
})();
