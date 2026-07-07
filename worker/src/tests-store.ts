import path from "path";
import fs from "fs";
import crypto from "crypto";
import type { LoginConfig } from "./pipeline";

const TESTS_PATH = process.env.TESTS_PATH || path.resolve("data/tests.json");

export interface SavedTest {
  id: string;
  name: string;
  targetUrl: string;
  /** 시나리오 카드 목록 — 각 항목이 독립 케이스로 실행됨 */
  scenarios: string[];
  loginConfig?: LoginConfig;
  createdAt: string;
  updatedAt: string;
  /** 마지막 실행 요약 — 목록 화면에서 상태를 한눈에 */
  lastRun?: {
    runId: string;
    status: "running" | "completed" | "failed";
    passed: number;
    failed: number;
    total: number;
    at: string;
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
  patch: Partial<Pick<SavedTest, "name" | "targetUrl" | "scenarios" | "loginConfig">>
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
