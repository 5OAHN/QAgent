import path from "path";
import fs from "fs";
import type { RunResult } from "./pipeline";

// 네이티브 의존성 없는 JSON 파일 기반 영속화 — Railway Volume을 data/ 디렉토리에 마운트하면
// 재배포 후에도 이력이 유지된다.
const DB_PATH = process.env.DB_PATH || path.resolve("data/runs.json");

function readAll(): Record<string, RunResult> {
  try {
    if (!fs.existsSync(DB_PATH)) return {};
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  } catch (err) {
    console.warn("⚠️ runs.json 읽기 실패 — 빈 상태로 시작합니다:", (err as Error).message);
    return {};
  }
}

function writeAll(data: Record<string, RunResult>): void {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  // 임시 파일에 먼저 쓰고 교체 — 쓰기 도중 프로세스가 죽어도 파일 손상 방지
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data));
  fs.renameSync(tmpPath, DB_PATH);
}

export function saveRun(run: RunResult): void {
  const all = readAll();
  all[run.runId] = run;
  writeAll(all);
}

export function loadAllRuns(): RunResult[] {
  return Object.values(readAll()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function loadRun(runId: string): RunResult | undefined {
  return readAll()[runId];
}

export function deleteRun(runId: string): boolean {
  const all = readAll();
  if (!(runId in all)) return false;
  delete all[runId];
  writeAll(all);
  return true;
}
