import path from "path";
import fs from "fs";

const KEYS_PATH = process.env.API_KEYS_PATH || path.resolve("data/api-keys.json");

interface ApiKeys {
  anthropicApiKey?: string;
  geminiApiKey?: string;
  /** 실행 완료 알림 웹훅 URL (Slack Incoming Webhook 호환) */
  webhookUrl?: string;
}

function readKeys(): ApiKeys {
  try {
    if (fs.existsSync(KEYS_PATH)) {
      return JSON.parse(fs.readFileSync(KEYS_PATH, "utf-8"));
    }
  } catch {}
  return {};
}

function writeKeys(keys: ApiKeys): void {
  fs.mkdirSync(path.dirname(KEYS_PATH), { recursive: true });
  fs.writeFileSync(KEYS_PATH, JSON.stringify(keys));
}

export function getApiKeys(): ApiKeys {
  return readKeys();
}

export function saveApiKeys(keys: Partial<ApiKeys>): void {
  const current = readKeys();
  writeKeys({ ...current, ...keys });
}

/** 환경변수 → 저장된 키 순서로 해석. 저장된 키가 있으면 우선 사용 */
export function resolveAnthropicKey(): string {
  const stored = readKeys().anthropicApiKey;
  return stored || process.env.ANTHROPIC_API_KEY || "";
}

export function resolveGeminiKey(): string {
  const stored = readKeys().geminiApiKey;
  return stored || process.env.GEMINI_API_KEY || "";
}

function mask(key?: string): string {
  if (!key || key.length < 8) return "";
  return key.slice(0, 8) + "••••••••" + key.slice(-4);
}

export function getMaskedKeys() {
  const keys = readKeys();
  return {
    anthropicApiKey: mask(keys.anthropicApiKey),
    geminiApiKey: mask(keys.geminiApiKey),
    hasAnthropic: !!keys.anthropicApiKey || !!process.env.ANTHROPIC_API_KEY,
    hasGemini: !!keys.geminiApiKey,
    webhookUrl: keys.webhookUrl || "",
  };
}
