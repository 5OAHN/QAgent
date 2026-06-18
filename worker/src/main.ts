import express, { Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { runExcelPipeline, runNaturalLanguagePipeline, getRunResult, cancelRun, pauseRun, resumeRun } from "./pipeline";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/data", express.static(path.resolve("data")));

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

  console.log(`\n🚀 [${runId}] 엑셀 파이프라인 시작${targetUrl ? ` → ${targetUrl}` : ""}`);

  runExcelPipeline(runId, req.file.path, targetUrl).catch((err) =>
    console.error(`[${runId}] 오류:`, err.message)
  );

  res.json({ run_id: runId, status: "queued" });
});

// ── 자연어 모드 트리거 ───────────────────────────────────────────────
app.post("/trigger/natural", (req: Request, res: Response) => {
  const { url, scenarios } = req.body as { url: string; scenarios: string | string[] };

  if (!url || !scenarios) {
    return res.status(400).json({ error: "url과 scenarios가 필요합니다." });
  }

  // 배열이면 그대로, 문자열이면 배열로 래핑
  const scenarioList: string[] = Array.isArray(scenarios)
    ? scenarios.filter((s) => s.trim())
    : [scenarios].filter((s) => s.trim());

  if (scenarioList.length === 0) {
    return res.status(400).json({ error: "scenarios가 비어 있습니다." });
  }

  const runId = crypto.randomUUID();

  console.log(`\n🚀 [${runId}] 자연어 파이프라인 시작 → ${url} (케이스 ${scenarioList.length}개)`);

  runNaturalLanguagePipeline(runId, url, scenarioList).catch((err) =>
    console.error(`[${runId}] 오류:`, err.message)
  );

  res.json({ run_id: runId, status: "queued" });
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

app.get("/health", (_: Request, res: Response) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 8001;
app.listen(PORT, () => console.log(`✅ QAgent Worker → http://localhost:${PORT}`));
