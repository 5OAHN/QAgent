"use client";

import useSWR from "swr";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type RunStatus = "running" | "completed" | "failed";
type ControlAction = "cancel" | "pause" | "resume";
type CaseStatus = "Pass" | "Fail" | "Pending";

interface UXSuggestion {
  area: string;
  issue: string;
  suggestion: string;
}

interface TestCase {
  testId: string;
  feature: string;
  scenario: string;
  status: CaseStatus;
  failReason: string;
  videoUrl: string;
  screenshotUrl: string;
  screenshotBase64?: string;
  consoleLogs?: string[];
  suggestions?: UXSuggestion[];
  verificationStatus?: "approved" | "rejected" | "pending";
  reviewReason?: string;
}

interface RunResult {
  runId: string;
  status: RunStatus;
  paused?: boolean;
  total: number;
  passed: number;
  failed: number;
  createdAt: string;
  cases: TestCase[];
  mode?: "excel" | "natural";
  targetUrl?: string;
  scenarios?: string;
  error?: string;
  loginStatus?: "running" | "success" | "fail";
  loginFailReason?: string;
  loginSteps?: string[];
}

const TERMINAL: RunStatus[] = ["completed", "failed"];
const fetcher = (url: string) => fetch(url).then((r) => r.json());

type FailCategory = "UI_BUG" | "LOADING_DELAY" | "SCENARIO_ERROR" | "SERVER_ERROR";
const CATEGORY_LABELS: Record<FailCategory, string> = {
  UI_BUG: "UI 버그", LOADING_DELAY: "로딩 지연", SCENARIO_ERROR: "시나리오 오류", SERVER_ERROR: "서버 에러",
};
function parseFailReason(raw: string): { category: FailCategory | null; label: string | null; reason: string } {
  const m = raw?.match(/^\[CATEGORY:(\w+)\]\s*/);
  if (m) {
    const c = m[1] as FailCategory;
    return { category: c, label: CATEGORY_LABELS[c] ?? null, reason: raw.slice(m[0].length) };
  }
  return { category: null, label: null, reason: raw };
}

// ── Apple design tokens ──────────────────────────────────────────────────────
const C = {
  indigo:      "#0066cc",
  indigoDark:  "#0055aa",
  indigoBg:    "#eff6ff",
  indigoBg2:   "#dbeafe",
  green:       "#16a34a",
  greenLight:  "#4ade80",
  greenBg:     "#f0fdf4",
  red:         "#dc2626",
  redBg:       "#fef2f2",
  amber:       "#d97706",
  amberBg:     "#fffbeb",
  // surfaces
  glass:       "#ffffff",
  glassDark:   "#ffffff",
  glassHover:  "#f5f5f7",
  border:      "#e0e0e0",
  borderSoft:  "#f0f0f0",
  // text
  text:        "#1d1d1f",
  textMid:     "#6b7280",
  textLight:   "#9ca3af",
  textFaint:   "#d1d5db",
  // terminal (keep dark for code readability)
  terminal:    "#0f0f13",
  termBorder:  "rgba(255,255,255,0.06)",
};

const glass = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: C.glass,
  border: `1px solid ${C.border}`,
  ...extra,
});

// 아직 시작되지 않은 시나리오도 Pending 상태로 미리 채워서 항상 전체 목록을 보여준다
function buildDisplayCases(data: RunResult): TestCase[] {
  if (data.total === 0) return data.cases;

  const scenarioTexts = data.mode === "natural" && data.scenarios
    ? data.scenarios.split("\n\n---\n\n")
    : [];

  const result: TestCase[] = [];
  for (let i = 0; i < data.total; i++) {
    const testId = data.mode === "natural" ? `V-${String(i + 1).padStart(3, "0")}` : undefined;
    const existing = testId
      ? data.cases.find((c) => c.testId === testId)
      : data.cases[i];

    if (existing) {
      result.push(existing);
    } else {
      result.push({
        testId: testId || `pending-${i}`,
        feature: data.mode === "natural" ? "Vision 에이전트" : "",
        scenario: scenarioTexts[i]?.trim().slice(0, 80) || `케이스 ${i + 1}`,
        status: "Pending",
        failReason: "",
        videoUrl: "",
        screenshotUrl: "",
        consoleLogs: [],
      });
    }
  }
  return result;
}

// ── Main component ─────────────────────────────────────────────────────────
export function RunDashboard({ runId }: { runId: string }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "pass" | "fail" | "review">("all");
  const prevCasesRef = useRef<Map<string, CaseStatus>>(new Map());

  const { data, error, isLoading, mutate } = useSWR<RunResult>(
    `/api/status?run_id=${runId}`,
    fetcher,
    {
      refreshInterval: (d) => (d?.status && TERMINAL.includes(d.status) ? 0 : 2000),
      revalidateOnFocus: true,
      refreshWhenHidden: false,
    }
  );

  useEffect(() => {
    if (!data?.cases) return;
    const running = data.cases.find((c) => c.status === "Pending");
    if (running) {
      setActiveId(running.testId);
    } else if (!activeId) {
      const firstDisplay = buildDisplayCases(data)[0];
      if (firstDisplay) setActiveId(firstDisplay.testId);
    }
    const next = new Map<string, CaseStatus>();
    data.cases.forEach((c) => next.set(c.testId, c.status));
    prevCasesRef.current = next;
  }, [data?.cases]);

  const sendControl = async (action: ControlAction) => {
    await fetch(`/api/run/${runId}/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await mutate();
  };

  if (isLoading) return <LoadingScreen />;
  if (error || !data) return <ErrorScreen msg={error?.message || "데이터를 불러올 수 없습니다."} />;

  const done = data.passed + data.failed;
  const progress = data.total > 0 ? Math.round((done / data.total) * 100) : 0;
  const displayCases = buildDisplayCases(data);
  const hasPendingCase = displayCases.some((c) => c.status === "Pending");
  // run.status가 완료로 바뀌었어도 케이스가 아직 Pending이면 컨트롤은 계속 노출
  const isTerminal = TERMINAL.includes(data.status) && !hasPendingCase;
  const activeCase = displayCases.find((c) => c.testId === activeId) ?? null;

  // Filter cases by selected tab
  const passCount = displayCases.filter((c) => c.status === "Pass" && c.verificationStatus !== "rejected").length;
  const failCount = displayCases.filter((c) => c.status === "Fail").length;
  const reviewCount = displayCases.filter((c) => c.verificationStatus === "pending").length;

  const filteredCases = displayCases.filter((c) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "pass") return c.status === "Pass" && c.verificationStatus !== "rejected";
    if (filterStatus === "fail") return c.status === "Fail";
    if (filterStatus === "review") return c.verificationStatus === "pending";
    return true;
  });

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden", fontFamily: "-apple-system, BlinkMacSystemFont, 'Geist', sans-serif" }}>

      {/* ── Middle: scenario list (glass panel) ───────────────────── */}
      <div style={{
        ...glass({ borderRadius: 0, borderTop: "none", borderBottom: "none", borderLeft: "none" }),
        width: 320,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        boxShadow: "none",
      }}>

        {/* Header */}
        <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${C.border}` }}>
          <Link href="/new" style={{ fontSize: 11, color: C.indigo, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 10, fontWeight: 500 }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 12 12"><path d="M8 2L4 6l4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            새 테스트
          </Link>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.4px" }}>실행 결과</h1>
              <p style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>
                {new Date(data.createdAt).toLocaleString("ko-KR")} · {runId.slice(0, 8)}…
              </p>
            </div>
            <RunStatusBadge status={data.status} paused={data.paused} />
          </div>

          {/* Progress */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textLight, marginBottom: 5 }}>
              <span>{done} / {data.total} 케이스</span>
              <span style={{ color: C.indigo, fontWeight: 600 }}>{progress}%</span>
            </div>
            <div style={{ height: 5, background: C.indigoBg, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: C.indigo, borderRadius: 999, transition: "width 0.5s ease" }} />
            </div>
          </div>

          {/* Summary chips */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            <SummaryChip label="전체" value={data.total} color={C.text} bg="#f5f5f7" />
            <SummaryChip label="Pass" value={data.passed} color={C.green} bg={C.greenBg} />
            <SummaryChip label="Fail" value={data.failed} color={C.red} bg={C.redBg} />
          </div>
        </div>

        {/* Verification tabs */}
        <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 4 }}>
          {[
            { key: "all" as const, label: "전체", count: displayCases.length },
            { key: "pass" as const, label: "✅ Pass", count: passCount },
            { key: "fail" as const, label: "❌ Fail", count: failCount },
            { key: "review" as const, label: "⚠️ Review", count: reviewCount },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              style={{
                flex: 1, padding: "6px 8px", borderRadius: 7, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", transition: "all 0.15s",
                background: filterStatus === tab.key ? C.indigo : "transparent",
                color: filterStatus === tab.key ? "#fff" : C.textMid,
              }}
            >
              {tab.label} <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 2 }}>({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Control buttons */}
        {!isTerminal && (
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 6 }}>
            {data.paused ? (
              <CtrlButton onClick={() => sendControl("resume")} variant="primary">▶ 재개</CtrlButton>
            ) : (
              <CtrlButton onClick={() => sendControl("pause")} variant="ghost">⏸ 일시정지</CtrlButton>
            )}
            <CtrlButton onClick={() => sendControl("cancel")} variant="danger">■ 중지</CtrlButton>
          </div>
        )}

        {/* 로그인 선행 작업 상태 */}
        {data.loginStatus && <LoginStatusBanner data={data} />}

        {/* Scenario list */}
        <div style={{ padding: "10px 12px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.textMid, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            시나리오
            <span style={{ marginLeft: 6, background: C.indigoBg, color: C.indigo, borderRadius: 999, padding: "1px 7px", fontSize: 10.5, fontWeight: 600 }}>
              {data.total}
            </span>
          </span>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 12px" }}>
          {filteredCases.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 100, color: C.textLight, fontSize: 13 }}>
              {!isTerminal
                ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><PulsingDot color={C.indigo} /> 준비 중…</span>
                : filterStatus === "all" ? "케이스 없음" : "필터링된 케이스가 없습니다"}
            </div>
          ) : (
            filteredCases.map((tc) => (
              <ScenarioCard
                key={tc.testId}
                tc={tc}
                isActive={tc.testId === activeId}
                onClick={() => setActiveId(tc.testId)}
                isPaused={!!data.paused}
                targetUrl={data.targetUrl}
                runId={runId}
                onVerify={() => mutate()}
              />
            ))
          )}

          {/* Retry / edit — 마지막 시나리오 카드 바로 아래 */}
          {data.mode === "natural" && data.targetUrl && data.scenarios && (isTerminal || data.paused) && (
            <button
              onClick={() => {
                const params = new URLSearchParams({ url: data.targetUrl!, scenarios: data.scenarios! });
                router.push(`/new?${params.toString()}`);
              }}
              style={{
                width: "100%", marginTop: 8, padding: "9px 0", borderRadius: 9,
                border: `1px solid ${C.border}`,
                background: C.indigoBg,
                color: C.indigo, fontSize: 12, fontWeight: 500, cursor: "pointer",
              }}
            >
              시나리오 수정 후 재시도
            </button>
          )}
        </div>
      </div>

      {/* ── Right: Viewer + Logs ───────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f7" }}>

        {/* Top bar */}
        <div style={{
          ...glass({ borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none" }),
          padding: "11px 20px",
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          boxShadow: "none",
        }}>
          {activeCase ? (
            <>
              <span style={{ fontSize: 11, fontFamily: "monospace", color: C.indigo, background: C.indigoBg, padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>{activeCase.testId}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeCase.scenario}</span>
              {activeCase.status !== "Pending" && <CaseStatusBadge status={activeCase.status} />}
              {activeCase.status === "Fail" && <CopyReportButton tc={activeCase} targetUrl={data.targetUrl} />}
            </>
          ) : (
            <span style={{ fontSize: 13, color: C.textLight }}>시나리오를 선택하세요</span>
          )}
        </div>

        {/* Browser mockup */}
        <div style={{ flex: "0 0 50%", padding: "16px 20px 8px", minHeight: 0 }}>
          <BrowserMockup tc={activeCase} isTerminal={isTerminal} />
        </div>

        {/* AI 제안 */}
        {(activeCase?.suggestions?.length ?? 0) > 0 && (
          <div style={{ flexShrink: 0, padding: "0 20px 8px" }}>
            <AISuggestionsAccordion suggestions={activeCase!.suggestions!} />
          </div>
        )}

        {/* Terminal logs */}
        <div style={{ flex: 1, padding: "0 20px 16px", minHeight: 0, display: "flex", flexDirection: "column" }}>
          <TerminalPanel tc={activeCase} isPaused={!!data.paused} />
        </div>
      </div>
    </div>
  );
}

// ── Scenario card ──────────────────────────────────────────────────────────
function ScenarioCard({ tc, isActive, onClick, isPaused, targetUrl, runId, onVerify }: {
  tc: TestCase; isActive: boolean; onClick: () => void; isPaused: boolean; targetUrl?: string; runId?: string; onVerify?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const isRunning = tc.status === "Pending";
  const isFail = tc.status === "Fail";
  const isReview = tc.verificationStatus === "pending";

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(buildErrorReport(tc, targetUrl)); }
    catch {
      const el = document.createElement("textarea");
      el.value = buildErrorReport(tc, targetUrl);
      document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async (e: React.MouseEvent, status: "approved" | "rejected") => {
    e.stopPropagation();
    if (!runId) return;
    setVerifying(true);
    try {
      const response = await fetch(`/api/run/${runId}/case/${tc.testId}/verify`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationStatus: status }),
      });
      if (response.ok) {
        onVerify?.();
      }
    } catch (err) {
      console.error("Verify failed:", err);
    }
    setVerifying(false);
  };

  return (
    <div
      onClick={onClick}
      style={{
        marginTop: 6, borderRadius: 11, cursor: "pointer", padding: "10px 12px",
        transition: "all .15s",
        background: isActive ? C.glass : isReview ? C.amberBg : isFail ? C.redBg : "#fafafc",
        border: isActive
          ? `1.5px solid ${C.indigo}`
          : isReview ? `1px solid rgba(217,119,6,0.3)` : isFail ? `1px solid #fecaca` : `1px solid ${C.border}`,
        boxShadow: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          {isRunning ? <PulsingDot color={C.indigo} />
            : isReview ? <span style={{ fontSize: 14 }}>⚠️</span>
            : tc.status === "Pass" ? <CheckCircle color={C.green} />
            : <XCircle color={C.red} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10.5, fontFamily: "monospace", color: isActive ? C.indigo : C.textMid, fontWeight: 600 }}>{tc.testId}</span>
              {isRunning && (
                <span style={{ fontSize: 10, color: isPaused ? C.amber : C.indigo, background: isPaused ? C.amberBg : C.indigoBg, padding: "1px 6px", borderRadius: 999, fontWeight: 600 }}>
                  {isPaused ? "일시정지" : "실행 중"}
                </span>
              )}
              {isReview && (
                <span style={{ fontSize: 10, color: C.amber, background: C.amberBg, padding: "1px 6px", borderRadius: 999, fontWeight: 600 }}>
                  확인 필요
                </span>
              )}
            </div>
            {isFail && !isReview && (
              <button onClick={handleCopy} style={{
                flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
                padding: "2px 7px", borderRadius: 6, cursor: "pointer",
                border: copied ? `1px solid ${C.green}` : `1px solid rgba(220,38,38,0.25)`,
                background: copied ? C.greenBg : C.redBg,
                color: copied ? C.green : C.red,
                fontSize: 10, fontWeight: 500, whiteSpace: "nowrap", transition: "all .2s",
              }}>
                {copied
                  ? <><svg width="10" height="10" fill="none"><path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>복사됨</>
                  : <>에러 복사</>}
              </button>
            )}
          </div>
          <p style={{ fontSize: 12.5, color: isFail && !isReview ? C.red : C.text, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>
            {tc.scenario}
          </p>
          {tc.failReason && !isReview && (
            <p style={{ marginTop: 5, fontSize: 11, color: C.red, opacity: 0.7, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>
              {tc.failReason}
            </p>
          )}
          {isReview && (
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button
                onClick={(e) => handleVerify(e, "approved")}
                disabled={verifying}
                style={{
                  padding: "4px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, border: "none", cursor: verifying ? "not-allowed" : "pointer",
                  background: C.green, color: "#fff", opacity: verifying ? 0.6 : 1, transition: "opacity 0.2s",
                }}
              >
                승인
              </button>
              <button
                onClick={(e) => handleVerify(e, "rejected")}
                disabled={verifying}
                style={{
                  padding: "4px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, border: "none", cursor: verifying ? "not-allowed" : "pointer",
                  background: C.red, color: "#fff", opacity: verifying ? 0.6 : 1, transition: "opacity 0.2s",
                }}
              >
                거부
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Browser mockup ─────────────────────────────────────────────────────────
function BrowserMockup({ tc, isTerminal }: { tc: TestCase | null; isTerminal: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && tc?.videoUrl) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [tc?.videoUrl]);

  return (
    <div style={{
      height: "100%", borderRadius: 14, overflow: "hidden",
      boxShadow: "none",
      border: `1px solid ${C.border}`,
      display: "flex", flexDirection: "column",
      background: C.glassDark,
      backdropFilter: "blur(12px)",
    }}>
      {/* Browser chrome */}
      <div style={{ background: "rgba(243,244,246,0.8)", padding: "9px 14px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, borderBottom: `1px solid ${C.borderSoft}` }}>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ff5f57" }} />
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#febc2e" }} />
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#28c840" }} />
        </div>
        <div style={{ flex: 1, background: "rgba(0,0,0,0.06)", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: C.textLight, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {tc?.videoUrl ? "recorded session" : "대기 중…"}
        </div>
        {tc?.status === "Pending" && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: C.red, background: C.redBg, padding: "3px 8px", borderRadius: 999 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.red, display: "inline-block", animation: "pulse 1s ease-in-out infinite" }} />
            REC
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", background: "rgba(248,250,252,0.6)" }}>
        {tc?.videoUrl ? (
          <video ref={videoRef} key={tc.videoUrl} src={tc.videoUrl} controls autoPlay
            style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
        ) : tc?.screenshotBase64 ? (
          <img src={`data:image/png;base64,${tc.screenshotBase64}`} alt="screenshot" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : tc?.screenshotUrl ? (
          <img src={tc.screenshotUrl} alt="screenshot" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : tc?.status === "Pending" ? (
          <LiveStepView tc={tc} isPaused={isTerminal} />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: `repeating-linear-gradient(135deg,${C.glass},${C.glass} 12px,rgba(229,231,235,0.4) 12px,rgba(229,231,235,0.4) 24px)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 12, color: C.textLight, background: C.glass, padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.borderSoft}` }}>미디어 없음</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AI 제안 아코디언 (영상↔로그 사이) ─────────────────────────────────────
function AISuggestionsAccordion({ suggestions }: { suggestions: UXSuggestion[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      borderRadius: 10,
      border: `1px solid ${C.borderSoft}`,
      background: C.indigoBg,
      overflow: "hidden",
    }}>
      {/* 헤더 */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "9px 14px", background: "none", border: "none", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 13 }}>💡</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.indigoDark, letterSpacing: "-0.2px" }}>
            AI 개선 제안
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, color: C.indigo,
            background: C.indigoBg2, padding: "1px 7px", borderRadius: 999,
          }}>
            {suggestions.length}
          </span>
        </div>
        <span style={{
          fontSize: 13, color: C.textMid,
          display: "inline-block",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s ease",
        }}>⌄</span>
      </button>

      {/* 제안 목록 */}
      {open && (
        <div style={{ borderTop: `1px solid ${C.borderSoft}`, padding: "8px 14px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {suggestions.map((s, i) => (
            <div key={i} style={{
              borderRadius: 8,
              border: `1px solid ${C.borderSoft}`,
              background: C.glass,
              padding: "10px 12px",
              display: "flex", flexDirection: "column", gap: 5,
            }}>
              <span style={{
                alignSelf: "flex-start", fontSize: 10, fontWeight: 600,
                color: C.indigo, background: C.indigoBg2,
                border: `1px solid #bfdbfe`,
                padding: "2px 8px", borderRadius: 999,
              }}>
                {s.area}
              </span>
              <p style={{ fontSize: 12, color: C.textMid, lineHeight: 1.6, margin: 0 }}>{s.issue}</p>
              <div style={{ display: "flex", gap: 5, alignItems: "flex-start" }}>
                <span style={{ fontSize: 11, color: C.green, flexShrink: 0, marginTop: 1, fontWeight: 700 }}>→</span>
                <p style={{ fontSize: 12, color: C.text, lineHeight: 1.6, margin: 0, fontWeight: 500 }}>{s.suggestion}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── UX 제안 패널 ──────────────────────────────────────────────────────────
function UXSuggestionsPanel({ suggestions }: { suggestions: UXSuggestion[] }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflowY: "auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>💡</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.3px" }}>AI 개선 제안</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>테스트 중 발견한 UX 문제점이에요</p>
        </div>
      </div>

      {suggestions.map((s, i) => (
        <div key={i} style={{
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.03)",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}>
          {/* 영역 배지 */}
          <span style={{
            display: "inline-block",
            alignSelf: "flex-start",
            fontSize: 10,
            fontWeight: 600,
            color: C.indigo,
            background: C.indigoBg,
            border: "1px solid #bfdbfe",
            padding: "2px 8px",
            borderRadius: 999,
            letterSpacing: "0.02em",
          }}>
            {s.area}
          </span>
          {/* 문제점 */}
          <p style={{ fontSize: 12, color: C.textMid, lineHeight: 1.6 }}>
            {s.issue}
          </p>
          {/* 제안 */}
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <span style={{ fontSize: 11, color: C.green, flexShrink: 0, marginTop: 1 }}>→</span>
            <p style={{ fontSize: 12, color: C.text, lineHeight: 1.6, fontWeight: 500 }}>
              {s.suggestion}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Live step view ─────────────────────────────────────────────────────────
function LiveStepView({ tc, isPaused }: { tc: TestCase; isPaused: boolean }) {
  const logs = tc.consoleLogs ?? [];
  const lastStep = logs[logs.length - 1] ?? null;

  const parseStep = (log: string) => {
    const m = log.match(/^\[Step (\d+)\] (.+?) — (.+)$/);
    if (m) return { num: m[1], action: m[2], thought: m[3] };
    return { num: "?", action: log, thought: "" };
  };

  const current = lastStep ? parseStep(lastStep) : null;
  const total = logs.length;

  return (
    <div style={{ position: "absolute", inset: 0, background: "#0a0a12", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 20 }}>
      {/* 스피너 + 스텝 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, maxWidth: 480, width: "100%" }}>
        <div style={{ position: "relative", width: 60, height: 60 }}>
          <svg width="60" height="60" viewBox="0 0 60 60" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(0,102,204,0.15)" strokeWidth="3" />
            <circle cx="30" cy="30" r="26" fill="none" stroke="#0066cc" strokeWidth="3"
              strokeDasharray="163.4" strokeDashoffset="0"
              style={{ animation: "dashSpin 1.6s linear infinite" }}
            />
          </svg>
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#0066cc", fontFamily: "monospace" }}>
            {total}
          </span>
        </div>

        {current ? (
          <div style={{ textAlign: "center", width: "100%" }}>
            <div style={{ fontSize: 10, color: "rgba(0,102,204,0.5)", fontFamily: "monospace", marginBottom: 6, letterSpacing: "0.1em" }}>STEP {current.num}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", marginBottom: 8, lineHeight: 1.4 }}>{current.action}</div>
            {current.thought && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 12px", textAlign: "left", border: "1px solid rgba(255,255,255,0.06)" }}>
                💭 {current.thought}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>에이전트 초기화 중…</div>
        )}
      </div>

      {/* 스텝 타임라인 */}
      {logs.length > 0 && (
        <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 3, maxHeight: 110, overflowY: "auto" }}>
          {logs.slice(-5).map((log, i) => {
            const s = parseStep(log);
            const isLast = i === Math.min(logs.length, 5) - 1;
            return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, opacity: isLast ? 1 : 0.3 }}>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: isLast ? "#0066cc" : "rgba(255,255,255,0.2)", flexShrink: 0, marginTop: 2 }}>
                  {String(logs.length - (Math.min(logs.length, 5) - 1 - i)).padStart(2, "0")}
                </span>
                <span style={{ fontSize: 11, color: isLast ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.action}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Terminal panel ─────────────────────────────────────────────────────────
function TerminalPanel({ tc, isPaused }: { tc: TestCase | null; isPaused: boolean }) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const isRunning = tc?.status === "Pending";

  useEffect(() => {
    if (isRunning) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [tc?.consoleLogs?.length, isRunning]);

  return (
    <div style={{ flex: 1, borderRadius: 12, border: `1px solid ${C.border}`, background: C.glass, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.borderSoft}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0, background: "rgba(243,244,246,0.7)" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.textMid, letterSpacing: "0.06em", textTransform: "uppercase" }}>실행 로그</span>
        {isRunning && <PulsingDot color={C.indigo} />}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", fontFamily: "monospace", fontSize: 12 }}>
        {!tc ? (
          <span style={{ color: C.textLight }}>시나리오를 선택하면 로그가 표시됩니다.</span>
        ) : (
          <>
            {tc.failReason && (() => {
              const { category, label, reason } = parseFailReason(tc.failReason);
              return (
                <div style={{ marginBottom: 8, padding: "8px 10px", borderRadius: 6, background: C.redBg, border: `1px solid rgba(220,38,38,0.2)` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: label ? 4 : 0 }}>
                    <span style={{ color: C.red, flexShrink: 0 }}>✗</span>
                    {label && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "rgba(220,38,38,0.12)", color: C.red, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        {label}
                      </span>
                    )}
                  </div>
                  <span style={{ color: C.red, lineHeight: 1.5, fontSize: 12 }}>{reason}</span>
                </div>
              );
            })()}
            {(tc.consoleLogs ?? []).length === 0 && !isRunning && (
              <span style={{ color: C.textLight }}>로그 없음</span>
            )}
            {tc.consoleLogs?.map((log, i) => {
              const isErr = /error|fail|timeout|못했습니다|실패|오류|찾지 못|찾을 수 없|❌/i.test(log);
              const isPass = /✅/.test(log);
              const lines = log.split("\n");
              return (
                <div key={i} style={{
                  padding: "5px 8px", marginBottom: 2, lineHeight: 1.6,
                  background: isErr ? C.redBg : isPass ? C.greenBg : i % 2 === 0 ? "#fafafa" : "transparent",
                  borderRadius: 6,
                  borderLeft: isErr ? `3px solid ${C.red}` : isPass ? `3px solid ${C.green}` : "3px solid transparent",
                }}>
                  {lines.map((line, j) => (
                    <div key={j} style={{
                      display: "flex", gap: 10,
                      paddingLeft: j > 0 ? 8 : 0,
                    }}>
                      {j === 0 && <span style={{ color: C.textFaint, flexShrink: 0, userSelect: "none", fontSize: 10, marginTop: 2 }}>{String(i + 1).padStart(2, "0")}</span>}
                      {j > 0 && <span style={{ width: 18, flexShrink: 0 }} />}
                      <span style={{
                        color: isErr ? C.red : isPass ? C.green : j > 0 ? C.textMid : C.text,
                        fontStyle: j > 0 ? "italic" : "normal",
                        fontSize: j > 0 ? 11 : 12,
                      }}>{line}</span>
                    </div>
                  ))}
                </div>
              );
            })}
            {isRunning && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, color: isPaused ? C.amber : C.indigo }}>
                {isPaused
                  ? <><span style={{ width: 6, height: 6, borderRadius: "50%", background: C.amber, display: "inline-block" }} /><span style={{ fontSize: 11 }}>일시정지됨</span></>
                  : <><BlinkingCursor /><span style={{ fontSize: 11 }}>분석 중…</span></>}
              </div>
            )}
            <div ref={logEndRef} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Error report builder ───────────────────────────────────────────────────
function buildErrorReport(tc: TestCase, targetUrl?: string): string {
  const recentLogs = (tc.consoleLogs ?? []).slice(-5);
  const { category, label, reason } = parseFailReason(tc.failReason);
  const lines = [
    `## 🚨 QAgent 에러 리포트`,
    ``,
    `| 항목 | 내용 |`,
    `|------|------|`,
    `| **테스트 ID** | \`${tc.testId}\` |`,
    `| **시나리오** | ${tc.scenario} |`,
    `| **상태** | ❌ Fail |`,
    ...(label ? [`| **실패 유형** | ${label} (${category}) |`] : []),
    ...(targetUrl ? [`| **진입 URL** | ${targetUrl} |`] : []),
    ``,
    `### ❗ 에러 메시지`,
    `\`\`\``,
    reason || "(에러 메시지 없음)",
    `\`\`\``,
  ];
  if (recentLogs.length > 0) {
    lines.push(``, `### 📋 최근 실행 로그 (마지막 ${recentLogs.length}줄)`, `\`\`\``);
    recentLogs.forEach((l) => lines.push(l));
    lines.push(`\`\`\``);
  }
  if (tc.screenshotUrl || tc.videoUrl) {
    lines.push(``, `### 🔗 첨부 파일`);
    if (tc.screenshotUrl) lines.push(`- 📸 스크린샷: [열기](${tc.screenshotUrl})`);
    if (tc.videoUrl)      lines.push(`- 🎬 녹화 영상: [열기](${tc.videoUrl})`);
  }
  lines.push(``, `---`, `*QAgent 자동 생성 리포트*`);
  return lines.join("\n");
}

// ── Top bar copy button ────────────────────────────────────────────────────
function CopyReportButton({ tc, targetUrl }: { tc: TestCase; targetUrl?: string }) {
  const [state, setState] = useState<"idle" | "copied">("idle");
  const handleClick = async () => {
    try { await navigator.clipboard.writeText(buildErrorReport(tc, targetUrl)); }
    catch {
      const el = document.createElement("textarea");
      el.value = buildErrorReport(tc, targetUrl);
      document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el);
    }
    setState("copied"); setTimeout(() => setState("idle"), 2000);
  };
  return (
    <button onClick={handleClick} style={{
      display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, flexShrink: 0, cursor: "pointer",
      border: state === "copied" ? `1px solid #bbf7d0` : `1px solid #bfdbfe`,
      background: state === "copied" ? C.greenBg : C.indigoBg,
      color: state === "copied" ? C.green : C.indigo,
      fontSize: 11, fontWeight: 500, transition: "all .2s",
    }}>
      {state === "copied"
        ? <><svg width="12" height="12" fill="none"><path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>복사됨!</>
        : <>에러 리포트 복사</>}
    </button>
  );
}

// ── Atoms ──────────────────────────────────────────────────────────────────
function SummaryChip({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: 9, padding: "7px 10px", border: "1px solid rgba(255,255,255,0.5)" }}>
      <span style={{ fontSize: 10, color: C.textLight, display: "block", marginBottom: 2 }}>{label}</span>
      <span style={{ fontSize: 17, fontWeight: 700, color, letterSpacing: "-0.5px" }}>{value}</span>
    </div>
  );
}

function CtrlButton({ children, onClick, variant }: { children: React.ReactNode; onClick: () => void; variant: "primary" | "ghost" | "danger" }) {
  const s = {
    primary: { background: C.indigo, color: "#fff", border: "none", boxShadow: "none" },
    ghost:   { background: C.glass, color: C.textMid, border: `1px solid ${C.border}` },
    danger:  { background: C.redBg, color: C.red, border: "1px solid #fecaca" },
  }[variant];
  return (
    <button onClick={onClick} style={{ ...s, flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
      {children}
    </button>
  );
}

function RunStatusBadge({ status, paused }: { status: RunStatus; paused?: boolean }) {
  if (status === "running" && paused)
    return <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: C.amberBg, color: C.amber, border: `1px solid rgba(217,119,6,0.25)` }}>일시정지</span>;
  const map = {
    running:   { bg: C.indigoBg2, color: C.indigo,  label: "실행 중",  border: "#bfdbfe" },
    completed: { bg: C.greenBg,   color: C.green,   label: "완료",    border: "#bbf7d0" },
    failed:    { bg: C.redBg,     color: C.red,     label: "오류",    border: "#fecaca" },
  };
  const { bg, color, label, border } = map[status];
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: bg, color, border: `1px solid ${border}` }}>{label}</span>;
}

function CaseStatusBadge({ status }: { status: "Pass" | "Fail" }) {
  return status === "Pass"
    ? <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: C.greenBg, color: C.green, border: "1px solid #bbf7d0" }}>Pass</span>
    : <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: C.redBg,   color: C.red,   border: "1px solid #fecaca" }}>Fail</span>;
}

function LoginStatusBanner({ data }: { data: RunResult }) {
  const [expanded, setExpanded] = useState(false);
  const { loginStatus, loginFailReason, loginSteps } = data;

  const styleByStatus = {
    running: { bg: C.indigoBg, color: C.indigo, border: "#bfdbfe", label: "로그인 진행 중…" },
    success: { bg: C.greenBg,  color: C.green,  border: "#bbf7d0", label: "로그인 완료" },
    fail:    { bg: C.redBg,    color: C.red,     border: "#fecaca", label: "로그인 실패" },
  } as const;
  const s = styleByStatus[loginStatus!];

  return (
    <div style={{ margin: "12px 12px 8px", borderRadius: 8, border: `1px solid ${s.border}`, background: s.bg, overflow: "hidden" }}>
      <button
        onClick={() => setExpanded((p) => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", background: "none", border: "none", cursor: "pointer" }}
      >
        {loginStatus === "running" && <PulsingDot color={s.color} />}
        <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>🔑 {s.label}</span>
        {loginStatus === "fail" && loginFailReason && (
          <span style={{ fontSize: 11, color: s.color, opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>
            — {loginFailReason}
          </span>
        )}
        {!!loginSteps?.length && (
          <svg width="11" height="11" fill="none" stroke={s.color} strokeWidth="2" viewBox="0 0 12 12" style={{ marginLeft: "auto", transform: expanded ? "rotate(180deg)" : "none", flexShrink: 0 }}>
            <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      {expanded && !!loginSteps?.length && (
        <div style={{ padding: "0 10px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
          {loginSteps.map((s2, i) => (
            <p key={i} style={{ fontSize: 11, color: C.textMid, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{s2}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function PulsingDot({ color }: { color: string }) {
  return <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: color, animation: "pulse 1.4s ease-in-out infinite", flexShrink: 0 }} />;
}

function BlinkingCursor() {
  return <span style={{ display: "inline-block", width: 7, height: 13, background: "#0066cc", borderRadius: 1, animation: "blink 1s step-end infinite" }} />;
}

function CheckCircle({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7.5" fill={color} fillOpacity=".12" stroke={color} strokeWidth="1"/>
      <path d="M5 8l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function XCircle({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7.5" fill={color} fillOpacity=".08" stroke={color} strokeWidth="1"/>
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function LoadingScreen() {
  return (
    <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: "#0066cc", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>Q</span>
        </div>
        <p style={{ fontSize: 13, color: C.textLight }}>불러오는 중…</p>
      </div>
    </div>
  );
}

function ErrorScreen({ msg }: { msg: string }) {
  return (
    <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 360, padding: "20px 24px", borderRadius: 14, border: "1px solid #fecaca", background: C.redBg, fontSize: 13, color: C.red }}>
        {msg}
      </div>
    </div>
  );
}

// ── Global keyframes ───────────────────────────────────────────────────────
if (typeof document !== "undefined") {
  const id = "__qa_keyframes";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
      @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      @keyframes dashSpin {
        0%   { stroke-dashoffset: 163.4; }
        100% { stroke-dashoffset: 0; }
      }
    `;
    document.head.appendChild(s);
  }
}
