import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { runExcelPipeline, runNaturalLanguagePipeline, getRunResult, getAllRuns, cancelRun, pauseRun, resumeRun, deleteRunResult } from "./pipeline";
import { verifyPassword, changePassword, verifyAdminPassword, changeAdminPassword, issueAdminToken, verifyAdminToken } from "./auth";
import { listTests, getTest, createTest, updateTest, deleteTest } from "./tests-store";
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
  // 토큰 발급 — 이후 실행 요청에 비밀번호 대신 사용 (비밀번호 변경 시 자동 무효화)
  res.json({ ok: true, adminToken: issueAdminToken() });
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
  const { anthropicApiKey, geminiApiKey, webhookUrl } = req.body as {
    anthropicApiKey?: string;
    geminiApiKey?: string;
    webhookUrl?: string;
  };
  const update: Record<string, string> = {};
  if (anthropicApiKey !== undefined) update.anthropicApiKey = anthropicApiKey.trim();
  if (geminiApiKey !== undefined) update.geminiApiKey = geminiApiKey.trim();
  if (webhookUrl !== undefined) update.webhookUrl = webhookUrl.trim();
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
      return res.json({ ok: true, message: "Claude API 키가 정상적으로 연결되었습니다." });
    } catch (err: any) {
      // Anthropic SDK는 err.message에 "400 {JSON}" 형태로 전달하거나 err.error 객체로 전달
      const errMsg: string = err.message || "";
      const body = err.error || {};
      const isLowCredit =
        errMsg.includes("credit balance") ||
        errMsg.includes("credit_balance") ||
        (body.message || "").includes("credit balance");

      if (isLowCredit) {
        return res.json({ ok: true, warning: "API 키는 유효하지만 크레딧이 부족합니다. Plans & Billing에서 충전 후 사용하세요." });
      }
      const msg = err.status === 401
        ? "유효하지 않은 API 키입니다. 키를 다시 확인해 주세요."
        : err.status === 403
        ? "해당 키로는 접근 권한이 없습니다."
        : "유효하지 않은 API 키이거나 연결에 실패했습니다.";
      return res.status(400).json({ ok: false, error: msg });
    }
  }

  if (provider === "gemini") {
    // 여러 모델을 순서대로 시도 — 모델별 quota/지원 여부가 다를 수 있음
    const GEMINI_MODELS = [
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-2.0-flash",
    ];

    let lastError = "";
    for (const model of GEMINI_MODELS) {
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }] }),
          }
        );
        const data = await r.json().catch(() => ({}));

        if (r.ok) {
          return res.json({ ok: true, message: `Gemini API 키가 정상적으로 연결되었습니다. (모델: ${model})` });
        }

        const errMsg: string = data.error?.message || "";
        const status = r.status;

        // 인증 실패 → 다른 모델 시도해도 의미 없음
        if (status === 400 && errMsg.includes("API key not valid")) {
          return res.status(400).json({ ok: false, error: "유효하지 않은 API 키입니다. 키를 다시 확인해 주세요." });
        }
        if (status === 403) {
          return res.status(400).json({ ok: false, error: "해당 키로는 접근 권한이 없습니다. Google Cloud 콘솔에서 Gemini API가 활성화되어 있는지 확인하세요." });
        }

        // quota 초과 → 키는 유효함
        if (status === 429 || errMsg.toLowerCase().includes("quota")) {
          return res.json({ ok: true, warning: "API 키는 유효하지만 무료 할당량이 초과되었습니다. 유료 플랜으로 업그레이드하거나 잠시 후 다시 시도하세요." });
        }

        // 모델 미지원 → 다음 모델 시도
        lastError = errMsg || `HTTP ${status}`;
        continue;
      } catch (err: any) {
        lastError = err.message;
        continue;
      }
    }

    // 모든 모델 실패
    return res.status(400).json({ ok: false, error: `Gemini 연결 실패: ${lastError}` });
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
  if (!checkRunAuth(req)) {
    return res.status(403).json({ error: "관리자 인증이 필요합니다.", code: "ADMIN_AUTH_REQUIRED" });
  }
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

// ── 실행 권한 검증 — 크레딧 소비 액션은 관리자 토큰(또는 비밀번호) 필수 ──
function checkRunAuth(req: Request): boolean {
  const token = (req.headers["x-qagent-admin-token"] as string) || (req.body?.adminToken as string) || "";
  if (token && verifyAdminToken(token)) return true;
  const password = req.body?.adminPassword as string | undefined;
  return !!password && verifyAdminPassword(password);
}

// ── 자연어 모드 트리거 ───────────────────────────────────────────────
app.post("/trigger/natural", (req: Request, res: Response) => {
  if (!checkRunAuth(req)) {
    return res.status(403).json({ error: "관리자 인증이 필요합니다.", code: "ADMIN_AUTH_REQUIRED" });
  }

  const { url, scenarios, executor, loginConfig, dashboardBaseUrl } = req.body as {
    url: string;
    scenarios: string | string[];
    executor?: string;
    loginConfig?: { fields: { label: string; value: string; isPassword: boolean }[] };
    dashboardBaseUrl?: string;
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

  runNaturalLanguagePipeline(runId, url, scenarioList, executor, loginConfig, { dashboardBaseUrl }).catch((err) =>
    console.error(`[${runId}] 오류:`, err.message)
  );

  res.json({ run_id: runId, status: "queued" });
});

// ── 저장된 테스트 CRUD ───────────────────────────────────────────────
// 응답에서 비밀번호 필드 값은 마스킹 — 수정 시 빈 값이면 저장된 값을 유지한다
function maskTestSecrets(test: any) {
  if (!test?.loginConfig?.fields) return test;
  return {
    ...test,
    loginConfig: {
      fields: test.loginConfig.fields.map((f: any) =>
        f.isPassword ? { ...f, value: "", hasStoredValue: !!f.value } : f
      ),
    },
  };
}

app.get("/tests", (_: Request, res: Response) => {
  res.json(listTests().map(maskTestSecrets));
});

app.post("/tests", (req: Request, res: Response) => {
  const { name, targetUrl, scenarios, loginConfig } = req.body as {
    name?: string; targetUrl?: string; scenarios?: string[]; loginConfig?: any;
  };
  if (!name?.trim() || !targetUrl?.trim() || !scenarios?.length) {
    return res.status(400).json({ error: "name, targetUrl, scenarios가 필요합니다." });
  }
  res.json(maskTestSecrets(createTest({ name, targetUrl, scenarios, loginConfig })));
});

app.put("/tests/:id", (req: Request, res: Response) => {
  const patch = { ...req.body };
  // 비밀번호 필드가 빈 값으로 오면 저장된 값을 유지 (마스킹된 폼 재제출 대응)
  if (patch.loginConfig?.fields) {
    const existing = getTest(req.params.id);
    patch.loginConfig = {
      fields: patch.loginConfig.fields.map((f: any) => {
        if (f.isPassword && !String(f.value || "").trim()) {
          const stored = existing?.loginConfig?.fields?.find(
            (e) => e.isPassword && e.label === f.label
          );
          if (stored?.value) return { label: f.label, value: stored.value, isPassword: true };
        }
        return { label: f.label, value: f.value, isPassword: !!f.isPassword };
      }),
    };
  }
  const updated = updateTest(req.params.id, patch);
  if (!updated) return res.status(404).json({ error: "테스트를 찾을 수 없습니다." });
  res.json(maskTestSecrets(updated));
});

app.delete("/tests/:id", (req: Request, res: Response) => {
  if (!deleteTest(req.params.id)) return res.status(404).json({ error: "테스트를 찾을 수 없습니다." });
  res.json({ ok: true });
});

// ── 저장된 테스트 실행 ───────────────────────────────────────────────
app.post("/tests/:id/run", (req: Request, res: Response) => {
  if (!checkRunAuth(req)) {
    return res.status(403).json({ error: "관리자 인증이 필요합니다.", code: "ADMIN_AUTH_REQUIRED" });
  }
  const test = getTest(req.params.id);
  if (!test) return res.status(404).json({ error: "테스트를 찾을 수 없습니다." });

  const { executor, dashboardBaseUrl } = req.body as { executor?: string; dashboardBaseUrl?: string };
  const runId = crypto.randomUUID();

  console.log(`\n🚀 [${runId}] 저장된 테스트 실행 → "${test.name}" (케이스 ${test.scenarios.length}개)`);

  runNaturalLanguagePipeline(runId, test.targetUrl, test.scenarios, executor, test.loginConfig, {
    testId: test.id,
    testName: test.name,
    dashboardBaseUrl,
  }).catch((err) => console.error(`[${runId}] 오류:`, err.message));

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
