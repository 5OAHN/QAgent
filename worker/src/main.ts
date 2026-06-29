import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { runExcelPipeline, runNaturalLanguagePipeline, getRunResult, getAllRuns, cancelRun, pauseRun, resumeRun, deleteRunResult } from "./pipeline";
import { verifyPassword, changePassword, verifyAdminPassword, changeAdminPassword } from "./auth";
import { saveRun } from "./db";
import { getMaskedKeys, saveApiKeys, resolveAnthropicKey, resolveGeminiKey } from "./api-keys";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/data", express.static(path.resolve("data")));

// ── 서비스 간 공유 시크릿 검증 — 프론트엔드 프록시만 통과 가능 ──────
const WORKER_API_KEY = process.env.WORKER_API_KEY;
if (WORKER_API_KEY) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === "/health") return next();
    if (req.headers["x-qagent-key"] !== WORKER_API_KEY) {
      return res.status(401).json({ error: "unauthorized" });
    }
    next();
  });
}

// ── 사용자 비밀번호 인증 ──────────────────────────────────────────────
app.post("/auth/login", (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  if (!password || !verifyPassword(password)) {
    return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
  }
  res.json({ ok: true });
});

// 비밀번호 파일을 초기화 — 다음 요청 시 INITIAL_APP_PASSWORD(또는 기본값)로 재생성됨
app.post("/auth/reset", (_req: Request, res: Response) => {
  const authPath = process.env.AUTH_PATH || path.resolve("data/auth.json");
  try { fs.unlinkSync(authPath); } catch {}
  res.json({ ok: true });
});

app.post("/auth/change-password", (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "현재 비밀번호와 새 비밀번호가 필요합니다." });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: "새 비밀번호는 4자 이상이어야 합니다." });
  }
  if (!changePassword(currentPassword, newPassword)) {
    return res.status(401).json({ error: "현재 비밀번호가 올바르지 않습니다." });
  }
  res.json({ ok: true });
});

// ── 관리자(테스트 생성) 비밀번호 인증 — API 크레딧 소비 액션 보호 ──────────
app.post("/auth/verify-admin", (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  if (!password || !verifyAdminPassword(password)) {
    return res.status(401).json({ error: "관리자 비밀번호가 올바르지 않습니다." });
  }
  res.json({ ok: true });
});

app.post("/auth/change-admin-password", (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "현재 비밀번호와 새 비밀번호가 필요합니다." });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: "새 비밀번호는 4자 이상이어야 합니다." });
  }
  if (!changeAdminPassword(currentPassword, newPassword)) {
    return res.status(401).json({ error: "현재 관리자 비밀번호가 올바르지 않습니다." });
  }
  res.json({ ok: true });
});

// ── API 키 관리 ────────────────────────────────────────────────────────────
app.get("/settings/api-keys", (_req: Request, res: Response) => {
  res.json(getMaskedKeys());
});

app.post("/settings/api-keys", (req: Request, res: Response) => {
  const { anthropicApiKey, geminiApiKey } = req.body as {
    anthropicApiKey?: string;
    geminiApiKey?: string;
  };
  const update: Record<string, string> = {};
  if (anthropicApiKey !== undefined) update.anthropicApiKey = anthropicApiKey.trim();
  if (geminiApiKey !== undefined) update.geminiApiKey = geminiApiKey.trim();
  saveApiKeys(update);
  res.json({ ok: true, masked: getMaskedKeys() });
});

// ── API 키 유효성 검증 ─────────────────────────────────────────────────────
app.post("/settings/verify-key", async (req: Request, res: Response) => {
  const { provider, apiKey } = req.body as { provider?: string; apiKey?: string };
  if (!provider || !apiKey) {
    return res.status(400).json({ ok: false, error: "provider와 apiKey가 필요합니다." });
  }

  if (provider === "claude") {
    try {
      const client = new Anthropic({ apiKey: apiKey.trim() });
      await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [{ role: "user", content: "hi" }],
      });
      return res.json({ ok: true });
    } catch (err: any) {
      const msg = err.status === 401 ? "인증 실패: API 키가 유효하지 않습니다."
        : err.status === 403 ? "권한 없음: 해당 키로 접근할 수 없습니다."
        : `연결 실패: ${err.message}`;
      return res.status(400).json({ ok: false, error: msg });
    }
  }

  if (provider === "gemini") {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey.trim()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }] }),
        }
      );
      if (r.ok) return res.json({ ok: true });
      const data = await r.json().catch(() => ({}));
      const msg = r.status === 400 ? "인증 실패: API 키가 유효하지 않습니다."
        : r.status === 403 ? "권한 없음: 해당 키로 접근할 수 없습니다."
        : data.error?.message || `연결 실패 (HTTP ${r.status})`;
      return res.status(400).json({ ok: false, error: msg });
    } catch (err: any) {
      return res.status(400).json({ ok: false, error: `연결 실패: ${err.message}` });
    }
  }

  return res.status(400).json({ ok: false, error: "지원하지 않는 provider입니다." });
});

const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    const dir = path.resolve("data/uploads");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// ── 엑셀 모드 트리거 ────────────────────────────────────────────────
app.post("/trigger/excel", upload.single("excel"), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "엑셀 파일이 필요합니다." });

  const runId = crypto.randomUUID();
  const targetUrl = req.body.url as string | undefined;
  const executor  = req.body.executor as string | undefined;

  console.log(`\n🚀 [${runId}] 엑셀 파이프라인 시작${targetUrl ? ` → ${targetUrl}` : ""}${executor ? ` (${executor})` : ""}`);

  runExcelPipeline(runId, req.file.path, targetUrl, executor).catch((err) =>
    console.error(`[${runId}] 오류:`, err.message)
  );

  res.json({ run_id: runId, status: "queued" });
});

// ── 자연어 모드 트리거 ───────────────────────────────────────────────
app.post("/trigger/natural", (req: Request, res: Response) => {
  const { url, scenarios, executor, loginConfig } = req.body as {
    url: string;
    scenarios: string | string[];
    executor?: string;
    loginConfig?: { fields: { label: string; value: string; isPassword: boolean }[] };
  };

  if (!url || !scenarios) {
    return res.status(400).json({ error: "url과 scenarios가 필요합니다." });
  }

  const scenarioList: string[] = Array.isArray(scenarios)
    ? scenarios.filter((s) => s.trim())
    : [scenarios].filter((s) => s.trim());

  if (scenarioList.length === 0) {
    return res.status(400).json({ error: "scenarios가 비어 있습니다." });
  }

  const runId = crypto.randomUUID();

  console.log(`\n🚀 [${runId}] 자연어 파이프라인 시작 → ${url} (케이스 ${scenarioList.length}개)${executor ? ` by ${executor}` : ""}`);

  runNaturalLanguagePipeline(runId, url, scenarioList, executor, loginConfig).catch((err) =>
    console.error(`[${runId}] 오류:`, err.message)
  );

  res.json({ run_id: runId, status: "queued" });
});

// ── 전체 실행 이력 조회 ──────────────────────────────────────────────
app.get("/runs", (_: Request, res: Response) => {
  res.json(getAllRuns());
});

// ── 상태 조회 ────────────────────────────────────────────────────────
app.get("/status/:runId", (req: Request, res: Response) => {
  const result = getRunResult(req.params.runId);
  if (!result) return res.status(404).json({ error: "실행 정보를 찾을 수 없습니다." });
  res.json(result);
});

// ── 실행 제어 ─────────────────────────────────────────────────────────
app.post("/run/:runId/cancel", (req: Request, res: Response) => {
  const ok = cancelRun(req.params.runId);
  res.json({ ok, action: "cancel" });
});

app.post("/run/:runId/pause", (req: Request, res: Response) => {
  const ok = pauseRun(req.params.runId);
  res.json({ ok, action: "pause" });
});

app.post("/run/:runId/resume", (req: Request, res: Response) => {
  const ok = resumeRun(req.params.runId);
  res.json({ ok, action: "resume" });
});

// ── 이력 삭제 ─────────────────────────────────────────────────────────
app.delete("/run/:runId", (req: Request, res: Response) => {
  const run = getRunResult(req.params.runId);
  if (!run) return res.status(404).json({ error: "실행 정보를 찾을 수 없습니다." });
  if (run.status === "running") return res.status(409).json({ error: "실행 중인 테스트는 삭제할 수 없습니다." });
  deleteRunResult(req.params.runId);
  res.json({ ok: true });
});

// ── 케이스 검증 상태 업데이트 ──────────────────────────────────────────
app.put("/run/:runId/case/:testId/verify", (req: Request, res: Response) => {
  const run = getRunResult(req.params.runId);
  if (!run) return res.status(404).json({ error: "실행 정보를 찾을 수 없습니다." });

  const { verificationStatus, note } = req.body;
  if (!verificationStatus || !["approved", "rejected"].includes(verificationStatus)) {
    return res.status(400).json({ error: "verificationStatus는 'approved' 또는 'rejected'이어야 합니다." });
  }

  const testCase = run.cases.find((c) => c.testId === req.params.testId);
  if (!testCase) return res.status(404).json({ error: "테스트 케이스를 찾을 수 없습니다." });

  testCase.verificationStatus = verificationStatus;
  if (note) testCase.reviewReason = note;
  saveRun(run);

  res.json({ ok: true, testCase });
});

app.get("/health", (_: Request, res: Response) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 8001;
app.listen(PORT, () => console.log(`✅ QAgent Worker → http://localhost:${PORT}`));
