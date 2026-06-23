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
  consoleLogs?: string[];
  suggestions?: UXSuggestion[];
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
}

const TERMINAL: RunStatus[] = ["completed", "failed"];
const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ── Light glassmorphism tokens ──────────────────────────────────────────────
const C = {
  indigo:      "#6366f1",
  indigoDark:  "#4338ca",
  indigoBg:    "rgba(99,102,241,0.08)",
  indigoBg2:   "rgba(99,102,241,0.12)",
  green:       "#16a34a",
  greenLight:  "#4ade80",
  greenBg:     "rgba(22,163,74,0.08)",
  red:         "#dc2626",
  redBg:       "rgba(220,38,38,0.07)",
  amber:       "#d97706",
  amberBg:     "rgba(217,119,6,0.08)",
  // glass surfaces
  glass:       "rgba(255,255,255,0.60)",
  glassDark:   "rgba(255,255,255,0.80)",
  glassHover:  "rgba(238,242,255,0.55)",
  border:      "rgba(255,255,255,0.65)",
  borderSoft:  "rgba(229,231,235,0.7)",
  // text
  text:        "#111827",
  textMid:     "#6b7280",
  textLight:   "#9ca3af",
  textFaint:   "#d1d5db",
  // terminal (keep dark for code readability)
  terminal:    "#0f0f13",
  termBorder:  "rgba(255,255,255,0.06)",
};

const glass = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: C.glass,
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: `1px solid ${C.border}`,
  ...extra,
});

// ── Main component ─────────────────────────────────────────────────────────
export function RunDashboard({ runId }: { runId: string }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
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
      const done = data.cases.find((c) => c.status !== "Pending");
      if (done) setActiveId(done.testId);
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
  const isTerminal = TERMINAL.includes(data.status);
  const activeCase = data.cases.find((c) => c.testId === activeId) ?? null;

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden", fontFamily: "-apple-system, BlinkMacSystemFont, 'Geist', sans-serif" }}>

      {/* ── Middle: scenario list (glass panel) ───────────────────── */}
      <div style={{
        ...glass({ borderRadius: 0, borderTop: "none", borderBottom: "none", borderLeft: "none" }),
        width: 320,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        boxShadow: "4px 0 24px rgba(99,102,241,0.06)",
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
            <div style={{ height: 5, background: "rgba(99,102,241,0.1)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #6366f1, #8b5cf6)", borderRadius: 999, transition: "width 0.5s ease" }} />
            </div>
          </div>

          {/* Summary chips */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            <SummaryChip label="전체" value={data.total} color={C.text} bg="rgba(243,244,246,0.8)" />
            <SummaryChip label="Pass" value={data.passed} color={C.green} bg={C.greenBg} />
            <SummaryChip label="Fail" value={data.failed} color={C.red} bg={C.redBg} />
          </div>
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

        {/* Scenario list */}
        <div style={{ padding: "10px 12px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.textMid, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            시나리오
            <span style={{ marginLeft: 6, background: "rgba(99,102,241,0.1)", color: C.indigo, borderRadius: 999, padding: "1px 7px", fontSize: 10.5, fontWeight: 600 }}>
              {data.cases.length}
            </span>
          </span>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 12px" }}>
          {data.cases.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 100, color: C.textLight, fontSize: 13 }}>
              {!isTerminal
                ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><PulsingDot color={C.indigo} /> 준비 중…</span>
                : "케이스 없음"}
            </div>
          ) : (
            data.cases.map((tc) => (
              <ScenarioCard
                key={tc.testId}
                tc={tc}
                isActive={tc.testId === activeId}
                onClick={() => setActiveId(tc.testId)}
                isPaused={!!data.paused}
                targetUrl={data.targetUrl}
              />
            ))
          )}
        </div>

        {/* Retry / edit */}
        {data.mode === "natural" && data.targetUrl && data.scenarios && (isTerminal || data.paused) && (
          <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}` }}>
            <button
              onClick={() => {
                const params = new URLSearchParams({ url: data.targetUrl!, scenarios: data.scenarios! });
                router.push(`/new?${params.toString()}`);
              }}
              style={{
                width: "100%", padding: "9px 0", borderRadius: 9,
                border: `1px solid rgba(99,102,241,0.2)`,
                background: "rgba(238,242,255,0.6)",
                color: C.indigo, fontSize: 12, fontWeight: 500, cursor: "pointer",
              }}
            >
              {data.paused ? "✏️ 시나리오 수정 후 재시도 ↩" : "수정 후 재시도 ↩"}
            </button>
          </div>
        )}
      </div>

      {/* ── Right: Viewer + Logs ───────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "rgba(248,250,252,0.4)" }}>

        {/* Top bar */}
        <div style={{
          ...glass({ borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none" }),
          padding: "11px 20px",
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          boxShadow: "0 4px 16px rgba(99,102,241,0.05)",
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
function ScenarioCard({ tc, isActive, onClick, isPaused, targetUrl }: {
  tc: TestCase; isActive: boolean; onClick: () => void; isPaused: boolean; targetUrl?: string;
}) {
  const [copied, setCopied] = useState(false);
  const isRunning = tc.status === "Pending";
  const isFail = tc.status === "Fail";

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

  return (
    <div
      onClick={onClick}
      style={{
        marginTop: 6, borderRadius: 11, cursor: "pointer", padding: "10px 12px",
        transition: "all .15s",
        background: isActive ? "rgba(255,255,255,0.85)" : isFail ? "rgba(254,242,242,0.6)" : "rgba(255,255,255,0.5)",
        border: isActive
          ? `1.5px solid rgba(99,102,241,0.4)`
          : isFail ? `1px solid rgba(220,38,38,0.2)` : `1px solid rgba(255,255,255,0.7)`,
        boxShadow: isActive ? "0 2px 12px rgba(99,102,241,0.14)" : "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          {isRunning ? <PulsingDot color={C.indigo} />
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
            </div>
            {isFail && (
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
          <p style={{ fontSize: 12.5, color: isFail ? C.red : C.text, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>
            {tc.scenario}
          </p>
          {tc.failReason && (
            <p style={{ marginTop: 5, fontSize: 11, color: C.red, opacity: 0.7, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>
              {tc.failReason}
            </p>
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
      boxShadow: "0 8px 32px rgba(99,102,241,0.12), 0 2px 8px rgba(0,0,0,0.06)",
      border: `1px solid rgba(255,255,255,0.7)`,
      display: "flex", flexDirection: "column",
      background: "#1a1a22",
    }}>
      {/* Browser chrome */}
      <div style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)", padding: "9px 14px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ff5f57" }} />
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#febc2e" }} />
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#28c840" }} />
        </div>
        <div style={{ flex: 1, background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {tc?.videoUrl ? "recorded session" : "대기 중…"}
        </div>
        {tc?.status === "Pending" && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#f87171", background: "rgba(248,113,113,0.1)", padding: "3px 8px", borderRadius: 999 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f87171", display: "inline-block", animation: "pulse 1s ease-in-out infinite" }} />
            REC
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", background: "#0f0f13" }}>
        {tc?.videoUrl ? (
          <video ref={videoRef} key={tc.videoUrl} src={tc.videoUrl} controls autoPlay
            style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
        ) : tc?.screenshotUrl ? (
          <img src={tc.screenshotUrl} alt="screenshot" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : tc?.status === "Pending" ? (
          <LiveStepView tc={tc} isPaused={isTerminal} />
        ) : (tc?.suggestions?.length ?? 0) > 0 ? (
          <UXSuggestionsPanel suggestions={tc!.suggestions!} />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(135deg,#16161e,#16161e 12px,#12121a 12px,#12121a 24px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.4)", padding: "6px 14px", borderRadius: 8 }}>미디어 없음</span>
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
                border: `1px solid rgba(99,102,241,0.2)`,
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
            color: "#818cf8",
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.25)",
            padding: "2px 8px",
            borderRadius: 999,
            letterSpacing: "0.02em",
          }}>
            {s.area}
          </span>
          {/* 문제점 */}
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
            {s.issue}
          </p>
          {/* 제안 */}
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <span style={{ fontSize: 11, color: "#6ee7b7", flexShrink: 0, marginTop: 1 }}>→</span>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, fontWeight: 500 }}>
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
            <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth="3" />
            <circle cx="30" cy="30" r="26" fill="none" stroke="#818cf8" strokeWidth="3"
              strokeDasharray="163.4" strokeDashoffset="0"
              style={{ animation: "dashSpin 1.6s linear infinite" }}
            />
          </svg>
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#818cf8", fontFamily: "monospace" }}>
            {total}
          </span>
        </div>

        {current ? (
          <div style={{ textAlign: "center", width: "100%" }}>
            <div style={{ fontSize: 10, color: "rgba(99,102,241,0.5)", fontFamily: "monospace", marginBottom: 6, letterSpacing: "0.1em" }}>STEP {current.num}</div>
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
                <span style={{ fontSize: 10, fontFamily: "monospace", color: isLast ? "#818cf8" : "rgba(255,255,255,0.2)", flexShrink: 0, marginTop: 2 }}>
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
    <div style={{ flex: 1, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: C.terminal, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
      <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, background: "rgba(255,255,255,0.03)" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em", textTransform: "uppercase" }}>실행 로그</span>
        {isRunning && <PulsingDot color="#818cf8" />}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", fontFamily: "monospace", fontSize: 12 }}>
        {!tc ? (
          <span style={{ color: "rgba(255,255,255,0.15)" }}>시나리오를 선택하면 로그가 표시됩니다.</span>
        ) : (
          <>
            {tc.failReason && (
              <div style={{ display: "flex", gap: 8, marginBottom: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)" }}>
                <span style={{ color: C.red, flexShrink: 0 }}>✗</span>
                <span style={{ color: "#fca5a5", lineHeight: 1.5 }}>{tc.failReason}</span>
              </div>
            )}
            {(tc.consoleLogs ?? []).length === 0 && !isRunning && (
              <span style={{ color: "rgba(255,255,255,0.15)" }}>로그 없음</span>
            )}
            {tc.consoleLogs?.map((log, i) => {
              const isErr = /error|fail|timeout|못했습니다|실패|오류|찾지 못|찾을 수 없/i.test(log);
              return (
                <div key={i} style={{ display: "flex", gap: 10, padding: "2px 0", lineHeight: 1.6, background: isErr ? "rgba(220,38,38,0.06)" : "transparent", borderRadius: isErr ? 4 : 0, paddingLeft: isErr ? 4 : 0 }}>
                  <span style={{ color: isErr ? "rgba(220,38,38,0.4)" : "rgba(255,255,255,0.15)", flexShrink: 0, userSelect: "none" }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ color: isErr ? "#fca5a5" : "rgba(255,255,255,0.5)" }}>{log}</span>
                </div>
              );
            })}
            {isRunning && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, color: isPaused ? "#fbbf24" : "#818cf8" }}>
                {isPaused
                  ? <><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fbbf24", display: "inline-block" }} /><span style={{ fontSize: 11 }}>일시정지됨</span></>
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
  const lines = [
    `## 🚨 QAgent 에러 리포트`,
    ``,
    `| 항목 | 내용 |`,
    `|------|------|`,
    `| **테스트 ID** | \`${tc.testId}\` |`,
    `| **시나리오** | ${tc.scenario} |`,
    `| **상태** | ❌ Fail |`,
    ...(targetUrl ? [`| **진입 URL** | ${targetUrl} |`] : []),
    ``,
    `### ❗ 에러 메시지`,
    `\`\`\``,
    tc.failReason || "(에러 메시지 없음)",
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
      border: state === "copied" ? `1px solid rgba(22,163,74,0.3)` : `1px solid rgba(99,102,241,0.2)`,
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
    primary: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" },
    ghost:   { background: "rgba(255,255,255,0.6)", color: C.textMid, border: `1px solid ${C.borderSoft}` },
    danger:  { background: "rgba(254,242,242,0.8)", color: C.red, border: "1px solid rgba(220,38,38,0.2)" },
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
    running:   { bg: C.indigoBg2, color: C.indigo,  label: "실행 중",  border: "rgba(99,102,241,0.2)" },
    completed: { bg: C.greenBg,   color: C.green,   label: "완료",    border: "rgba(22,163,74,0.2)" },
    failed:    { bg: C.redBg,     color: C.red,     label: "오류",    border: "rgba(220,38,38,0.2)" },
  };
  const { bg, color, label, border } = map[status];
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: bg, color, border: `1px solid ${border}` }}>{label}</span>;
}

function CaseStatusBadge({ status }: { status: "Pass" | "Fail" }) {
  return status === "Pass"
    ? <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: C.greenBg, color: C.green, border: "1px solid rgba(22,163,74,0.2)" }}>Pass</span>
    : <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: C.redBg,   color: C.red,   border: "1px solid rgba(220,38,38,0.2)" }}>Fail</span>;
}

function PulsingDot({ color }: { color: string }) {
  return <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: color, animation: "pulse 1.4s ease-in-out infinite", flexShrink: 0 }} />;
}

function BlinkingCursor() {
  return <span style={{ display: "inline-block", width: 7, height: 13, background: "#818cf8", borderRadius: 1, animation: "blink 1s step-end infinite" }} />;
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
        <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>Q</span>
        </div>
        <p style={{ fontSize: 13, color: C.textLight }}>불러오는 중…</p>
      </div>
    </div>
  );
}

function ErrorScreen({ msg }: { msg: string }) {
  return (
    <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 360, padding: "20px 24px", borderRadius: 14, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(254,242,242,0.9)", fontSize: 13, color: C.red }}>
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
