import path from "path";
import fs from "fs";
import crypto from "crypto";

const AUTH_PATH = process.env.AUTH_PATH || path.resolve("data/auth.json");

interface AuthState {
  passwordHash: string;
  version: number;
}

function hash(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function readState(): AuthState {
  try {
    if (fs.existsSync(AUTH_PATH)) {
      return JSON.parse(fs.readFileSync(AUTH_PATH, "utf-8"));
    }
  } catch (err) {
    console.warn("⚠️ auth.json 읽기 실패 — 기본 비밀번호로 초기화합니다:", (err as Error).message);
  }
  const initial: AuthState = {
    passwordHash: hash(process.env.INITIAL_APP_PASSWORD || "qagent"),
    version: 1,
  };
  writeState(initial);
  return initial;
}

function writeState(state: AuthState): void {
  fs.mkdirSync(path.dirname(AUTH_PATH), { recursive: true });
  fs.writeFileSync(AUTH_PATH, JSON.stringify(state));
}

export function verifyPassword(password: string): boolean {
  return readState().passwordHash === hash(password);
}

export function changePassword(currentPassword: string, newPassword: string): boolean {
  const state = readState();
  if (state.passwordHash !== hash(currentPassword)) return false;
  writeState({ passwordHash: hash(newPassword), version: state.version + 1 });
  return true;
}
