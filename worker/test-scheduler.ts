// 스케줄러 판정 로직 검증 — data/tests.json을 임시 경로로 격리해서 실행
import fs from "fs";
import path from "path";

const TMP_DIR = path.resolve(__dirname, ".test-tmp");
fs.mkdirSync(TMP_DIR, { recursive: true });
process.env.TESTS_PATH = path.join(TMP_DIR, "tests.json");

import { createTest, updateTest, getDueScheduledTests, markScheduledTrigger, currentTriggerKey } from "./src/tests-store";

function assert(cond: boolean, label: string) {
  if (cond) console.log(`  ✅ ${label}`);
  else { console.error(`  ❌ FAIL: ${label}`); process.exitCode = 1; }
}

function kstDate(y: number, m: number, d: number, h: number, min: number, day: number): Date {
  // day: 0=일 ... 6=토 — 임의 기준일(2025-01-05는 일요일)에서 오프셋으로 요일을 맞춘다
  const base = new Date(Date.UTC(y, m - 1, d, h - 9, min)); // KST = UTC+9
  return base;
}

async function main() {
  const t1 = createTest({ name: "매일 9시", targetUrl: "https://example.com", scenarios: ["1. 확인"] });
  updateTest(t1.id, { schedule: { frequency: "daily", hour: 9 } });

  const t2 = createTest({ name: "매시간", targetUrl: "https://example.com", scenarios: ["1. 확인"] });
  updateTest(t2.id, { schedule: { frequency: "hourly" } });

  const t3 = createTest({ name: "예약없음", targetUrl: "https://example.com", scenarios: ["1. 확인"] });

  console.log("\n[1] 09:00 KST, 정시 — daily(9시)와 hourly는 대상, 예약없음은 제외");
  const at9 = new Date("2025-01-06T00:00:00.000Z"); // 2025-01-06 09:00 KST (월요일)
  let due = getDueScheduledTests(at9);
  assert(due.some((t) => t.id === t1.id), "daily(9시) 테스트가 대상에 포함됨");
  assert(due.some((t) => t.id === t2.id), "hourly 테스트가 대상에 포함됨");
  assert(!due.some((t) => t.id === t3.id), "예약없음 테스트는 제외됨");

  console.log("\n[2] 같은 시각(같은 트리거키)에 중복 실행 방지");
  const key = currentTriggerKey(at9);
  markScheduledTrigger(t1.id, key);
  due = getDueScheduledTests(at9);
  assert(!due.some((t) => t.id === t1.id), "트리거 후 같은 시각 재조회 시 제외됨 (중복 방지)");
  assert(due.some((t) => t.id === t2.id), "다른 테스트(hourly)는 여전히 대상");

  console.log("\n[3] 09:05 KST — 정시가 아니므로 아무것도 대상 아님");
  const at905 = new Date("2025-01-06T00:05:00.000Z");
  due = getDueScheduledTests(at905);
  assert(due.length === 0, "정시가 아니면 스케줄러가 아무것도 트리거하지 않음");

  console.log("\n[4] 10:00 KST — daily(9시)는 제외, hourly는 새 트리거키라 다시 대상");
  const at10 = new Date("2025-01-06T01:00:00.000Z");
  due = getDueScheduledTests(at10);
  assert(!due.some((t) => t.id === t1.id), "daily(9시)는 10시엔 대상 아님");
  assert(due.some((t) => t.id === t2.id), "hourly는 매 정시 다시 대상");

  console.log("\n[5] 토요일 09:00 KST — weekdays 테스트는 주말 제외");
  const t4 = createTest({ name: "평일만", targetUrl: "https://example.com", scenarios: ["1. 확인"] });
  updateTest(t4.id, { schedule: { frequency: "weekdays", hour: 9 } });
  const saturday9 = new Date("2025-01-11T00:00:00.000Z"); // 2025-01-11은 토요일
  due = getDueScheduledTests(saturday9);
  assert(!due.some((t) => t.id === t4.id), "토요일엔 weekdays 테스트가 대상 아님");
  const monday9 = new Date("2025-01-13T00:00:00.000Z"); // 2025-01-13은 월요일
  due = getDueScheduledTests(monday9);
  assert(due.some((t) => t.id === t4.id), "월요일엔 weekdays 테스트가 대상");

  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  console.log(process.exitCode ? "\n❌ 일부 검증 실패" : "\n🎉 스케줄러 판정 로직 전체 검증 통과");
}

main();
