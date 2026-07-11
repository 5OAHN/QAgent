import path from "path";
import fs from "fs";
import crypto from "crypto";
import type { LoginConfig } from "./pipeline";

const TESTS_PATH = process.env.TESTS_PATH || path.resolve("data/tests.json");

export interface ScheduleConfig {
  /** off=예약 없음(수동만), daily=매일, weekdays=평일만, hourly=매시간 */
  frequency: "off" | "hourly" | "daily" | "weekdays";
  /** daily/weekdays일 때 실행 시각(KST, 0-23시). hourly는 무시됨 */
  hour?: number;
}

export interface SavedTest {
  id: string;
  name: string;
  targetUrl: string;
  /** 시나리오 카드 목록 — 각 항목이 독립 케이스로 실행됨 */
  scenarios: string[];
  loginConfig?: LoginConfig;
  createdAt: string;
  updatedAt: string;
  schedule?: ScheduleConfig;
  /** 스케줄러가 마지막으로 예약 실행을 시작한 분(YYYY-MM-DDTHH:mm, KST) — 중복 트리거 방지 */
  lastScheduledTriggerKey?: string;
  /** 마지막 실행 요약 — 목록 화면에서 상태를 한눈에 */
  lastRun?: {
    runId: string;
    status: "running" | "completed" | "failed";
    passed: number;
    failed: number;
    total: number;
    at: string;
    triggeredBy?: "manual" | "schedule";
  };
}

function readAll(): SavedTest[] {
  try {
    if (fs.existsSync(TESTS_PATH)) {
      return JSON.parse(fs.readFileSync(TESTS_PATH, "utf-8"));
    }
  } catch {}
  return [];
}

function writeAll(tests: SavedTest[]): void {
  fs.mkdirSync(path.dirname(TESTS_PATH), { recursive: true });
  fs.writeFileSync(TESTS_PATH, JSON.stringify(tests, null, 2));
}

export function listTests(): SavedTest[] {
  return readAll().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getTest(id: string): SavedTest | undefined {
  return readAll().find((t) => t.id === id);
}

export function createTest(input: {
  name: string;
  targetUrl: string;
  scenarios: string[];
  loginConfig?: LoginConfig;
}): SavedTest {
  const now = new Date().toISOString();
  const test: SavedTest = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    targetUrl: input.targetUrl.trim(),
    scenarios: input.scenarios.map((s) => s.trim()).filter(Boolean),
    loginConfig: input.loginConfig,
    createdAt: now,
    updatedAt: now,
  };
  const all = readAll();
  all.push(test);
  writeAll(all);
  return test;
}

export function updateTest(
  id: string,
  patch: Partial<Pick<SavedTest, "name" | "targetUrl" | "scenarios" | "loginConfig" | "schedule">>
): SavedTest | undefined {
  const all = readAll();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return undefined;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  writeAll(all);
  return all[idx];
}

export function deleteTest(id: string): boolean {
  const all = readAll();
  const next = all.filter((t) => t.id !== id);
  if (next.length === all.length) return false;
  writeAll(next);
  return true;
}

export function recordLastRun(id: string, lastRun: SavedTest["lastRun"]): void {
  const all = readAll();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return;
  all[idx].lastRun = lastRun;
  writeAll(all);
}

export function markScheduledTrigger(id: string, triggerKey: string): void {
  const all = readAll();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return;
  all[idx].lastScheduledTriggerKey = triggerKey;
  writeAll(all);
}

/** 현재 시각(KST)의 트리거 키(시 단위) — 예약 실행 중복 방지에 사용 */
export function currentTriggerKey(now: Date): string {
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}T${String(kst.getHours()).padStart(2, "0")}:00`;
}

/** 예약 실행 대상 판정 — 스케줄러가 매분 호출. KST 기준, 정시(0분)에만 발화한다. */
export function getDueScheduledTests(now: Date): SavedTest[] {
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const day = kst.getDay(); // 0=일 6=토
  const hour = kst.getHours();
  const minute = kst.getMinutes();
  if (minute !== 0) return [];

  const triggerKey = currentTriggerKey(now);

  return readAll().filter((t) => {
    const sch = t.schedule;
    if (!sch || sch.frequency === "off") return false;
    if (t.lastScheduledTriggerKey === triggerKey) return false; // 이미 이 시각에 트리거함
    if (sch.frequency === "hourly") return true;
    if (sch.frequency === "daily") return hour === (sch.hour ?? 9);
    if (sch.frequency === "weekdays") return day >= 1 && day <= 5 && hour === (sch.hour ?? 9);
    return false;
  });
}
