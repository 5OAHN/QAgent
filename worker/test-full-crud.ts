/**
 * 실제 CRUD 시나리오 (LLM 호출 포함)
 *
 * runNaturalLanguageScenario를 호출해 AI와 함께 TodoMVC CRUD를 수행
 * 실행: ANTHROPIC_API_KEY=sk-... npx ts-node --transpile-only test-full-crud.ts
 */
import { chromium } from "playwright";
import { runNaturalLanguageScenario } from "./src/pipeline";

async function main() {
  console.log("🚀 TodoMVC CRUD 풀 시나리오 테스트 (LLM 포함)");
  console.log("═".repeat(70));

  const scenarios = [
    "입력창에 '테스트1'을 입력하고 Enter를 누른다. 목록에 '테스트1'이 표시되고 '1 item left!'가 보이면 성공",
    "'테스트1' 항목을 더블클릭해 편집 모드로 진입한다. 입력창이 보이면 성공",
    "텍스트를 '테스트1-수정됨'으로 바꾼다. 변경되면 성공",
    "Enter를 누른다. 수정 내용이 저장되고 목록에 '테스트1-수정됨'이 표시되면 성공",
    "'테스트1-수정됨' 항목의 체크박스를 클릭한다. 항목에 취소선이 그어지고 '0 items left'가 표시되면 성공",
    "'테스트1-수정됨' 항목 우측의 X 버튼을 클릭한다. 목록에서 사라지면 성공"
  ];

  try {
    console.log(`\n📋 시나리오 ${scenarios.length}개 실행 시작...\n`);

    const result = await runNaturalLanguageScenario({
      runId: "local-test-" + Date.now(),
      targetUrl: "https://todomvc.com/examples/react/dist/",
      scenarioList: scenarios,
      executor: "ai",
      mode: "natural",
    });

    // 결과 출력
    console.log("\n" + "═".repeat(70));
    console.log("📊 최종 결과");
    console.log("═".repeat(70));
    console.log(`상태: ${result.status}`);
    console.log(`통과: ${result.passed} / 실패: ${result.failed} / 차단: ${result.cases.filter(c => c.status === "Blocked").length} / 전체: ${result.total}`);

    console.log("\n" + "─".repeat(70));
    result.cases.forEach((tc, i) => {
      const icon = tc.status === "Pass" ? "✅" : tc.status === "Fail" ? "❌" : "⚠️";
      console.log(`${icon} [${tc.testId}] ${tc.status}`);
      if (tc.scenario) {
        console.log(`   시나리오: ${tc.scenario.slice(0, 60)}...`);
      }
      if (tc.failReason) {
        console.log(`   실패 사유: ${tc.failReason}`);
      }
      if (tc.tokenUsage) {
        console.log(`   토큰: ${tc.tokenUsage} / 시간: ${tc.durationMs}ms`);
      }
    });

    console.log("\n" + "═".repeat(70));
    const allPassed = result.passed === result.total;
    if (allPassed) {
      console.log("🎉 모든 시나리오 통과!");
      process.exit(0);
    } else {
      console.log(`⚠️ ${result.failed}개 실패 (${result.passed}/${result.total} 통과)`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error("\n❌ 테스트 실행 오류:");
    console.error(error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

main();
