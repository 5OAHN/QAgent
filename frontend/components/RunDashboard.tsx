"use client";

import useSWR from "swr";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type RunStatus = "running" | "completed" | "failed";
type ControlAction = "cancel" | "pause" | "resume";
type CaseStatus = "Pass" | "Fail" | "Pending";

interface TestCase {
  testId: string;
  feature: string;
  scenario: string;
  status: CaseStatus;
  failReason: string;
  videoUrl: string;
  screenshotUrl: string;
  consoleLogs?: string[];
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

// ── Design tokens (다크 모드 — 첫 화면 톤 기준) ──────────────────────────
const C = {
  purple:     "#0099ff",
  purpleDark: "#007acc",
  purpleBg:   "rgba(0,153,255,.08)",
  purpleBg2:  "rgba(0,153,255,.12)",
  green:      "#4ade80",
  greenBg:    "rgba(74,222,128,.08)",
  red:        "#f87171",
  redBg:      "rgba(248,113,113,.08)",
  bg:         "#090909",
  bgAlt:      "#0d0d0d",
  bgAlt2:     "#141414",
  surface:    "#141414",
  border:     "#1a1a1a",
  borderMid:  "#262626",
  borderDark: "#333333",
  textPrimary:"#ffffff",
  textMid:    "#999999",
  textLight:  "#777777",
  textFaint:  "#555555",
  terminal:   "#0a0a0a",
  terminalBorder: "#1a1a1a",
};

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

  // Auto-select: when a case transitions Pending → Pass/Fail, auto-show it
  useEffect(() => {
    if (!data?.cases) return;
    for (const tc of data.cases) {
      const prevStatus = prevCasesRef.current.get(tc.testId);
      if (prevStatus === "Pending" && tc.status !== "Pending") {
        setActiveId(tc.testId);
      }
    }
    const next = new Map<string, CaseStatus>();
    data.cases.forEach((c) => next.set(c.testId, c.status));
    prevCasesRef.current = next;
  }, [data?.cases]);

  // Auto-select first case when data loads
  useEffect(() => {
    if (data?.cases?.length && !activeId) {
      const done = data.cases.find((c) => c.status !== "Pending");
      if (done) setActiveId(done.testId);
    }
  }, [data?.cases, activeId]);

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
    <div style={{ display: "flex", height: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Geist', sans-serif", overflow: "hidden" }}>

      {/* ── Left sidebar ──────────────────────────────────────── */}
      <aside style={{ width: 56, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, flexShrink: 0, gap: 8 }}>
        {/* Logo */}
        <div style={{ width: 32, height: 32, borderRadius: 8, background: C.purple, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: "-0.5px" }}>Q</span>
        </div>
        <div style={{ flex: 1 }} />
        <SideIcon title="홈" href="/">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
        </SideIcon>
        <SideIcon title="설정">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        </SideIcon>
      </aside>

      {/* ── Middle: Scenario list ──────────────────────────────── */}
      <div style={{ width: 340, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        {/* Header */}
        <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${C.border}` }}>
          <Link href="/" style={{ fontSize: 11, color: C.purple, textDecoration: "none", display: "block", marginBottom: 8 }}>
            ← 새 테스트
          </Link>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.3px" }}>실행 결과</h1>
              <p style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>
                {new Date(data.createdAt).toLocaleString("ko-KR")} · {runId.slice(0, 8)}…
              </p>
            </div>
            <RunStatusBadge status={data.status} paused={data.paused} />
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textFaint, marginBottom: 5 }}>
              <span>{done} / {data.total} 케이스</span>
              <span style={{ color: C.purple, fontWeight: 600 }}>{progress}%</span>
            </div>
            <div style={{ height: 4, background: C.bgAlt2, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: C.purple, borderRadius: 999, transition: "width 0.5s ease" }} />
            </div>
          </div>

          {/* Summary chips */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            <SummaryChip label="전체" value={data.total} color={C.textPrimary} bg={C.bgAlt} />
            <SummaryChip label="Pass" value={data.passed} color={C.green} bg={C.greenBg} />
            <SummaryChip label="Fail" value={data.failed} color={C.red} bg={C.redBg} />
          </div>
        </div>

        {/* Control buttons */}
        {!isTerminal && (
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 6 }}>
            {data.paused ? (
              <CtrlButton onClick={() => sendControl("resume")} variant="primary">▶ 재개</CtrlButton>
            ) : (
              <CtrlButton onClick={() => sendControl("pause")} variant="ghost">⏸ 일시정지</CtrlButton>
            )}
            <CtrlButton onClick={() => sendControl("cancel")} variant="danger">■ 중지</CtrlButton>
          </div>
        )}

        {/* Scenario list header */}
        <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textMid }}>
            시나리오
            <span style={{ marginLeft: 6, background: C.bgAlt2, color: C.textLight, borderRadius: 999, padding: "1px 7px", fontSize: 11, fontWeight: 500 }}>
              {data.cases.length}
            </span>
          </span>
        </div>

        {/* Scenario cards */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 16px" }}>
          {data.cases.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120, color: C.textFaint, fontSize: 13 }}>
              {!isTerminal ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <PulsingDot color={C.purple} /> 준비 중…
                </span>
              ) : "케이스 없음"}
            </div>
          ) : (
            data.cases.map((tc) => (
              <ScenarioCard
                key={tc.testId}
                tc={tc}
                isActive={tc.testId === activeId}
                onClick={() => setActiveId(tc.testId)}
                isPaused={!!data.paused}
              />
            ))
          )}
        </div>

        {/* Retry button */}
        {data.mode === "natural" && data.targetUrl && data.scenarios && isTerminal && (
          <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.border}` }}>
            <button
              onClick={() => {
                const params = new URLSearchParams({ url: data.targetUrl!, scenarios: data.scenarios! });
                router.push(`/?${params.toString()}`);
              }}
              style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: `1px solid ${C.borderMid}`, background: C.surface, color: C.textMid, fontSize: 12, fontWeight: 500, cursor: "pointer" }}
            >
              수정 후 재시도 ↩
            </button>
          </div>
        )}
      </div>

      {/* ── Right: Viewer + Logs ────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bgAlt }}>

        {/* Top bar */}
        <div style={{ padding: "12px 20px", background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {activeCase ? (
            <>
              <span style={{ fontSize: 11, fontFamily: "monospace", color: C.textFaint, background: C.bgAlt2, padding: "2px 8px", borderRadius: 5 }}>{activeCase.testId}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeCase.scenario}</span>
              {activeCase.status !== "Pending" && <CaseStatusBadge status={activeCase.status} />}
            </>
          ) : (
            <span style={{ fontSize: 13, color: C.textFaint }}>시나리오를 선택하세요</span>
          )}
        </div>

        {/* Browser mockup */}
        <div style={{ flex: "0 0 56%", padding: "16px 20px 8px", minHeight: 0 }}>
          <BrowserMockup tc={activeCase} isTerminal={isTerminal} />
        </div>

        {/* Terminal logs */}
        <div style={{ flex: 1, padding: "0 20px 16px", minHeight: 0, display: "flex", flexDirection: "column" }}>
          <TerminalPanel tc={activeCase} isPaused={!!data.paused} />
        </div>
      </div>
    </div>
  );
}

// ── Scenario card ──────────────────────────────────────────────────────────
function ScenarioCard({
  tc, isActive, onClick, isPaused,
}: {
  tc: TestCase; isActive: boolean; onClick: () => void; isPaused: boolean;
}) {
  const isRunning = tc.status === "Pending";
  const isFail = tc.status === "Fail";

  return (
    <div
      onClick={onClick}
      style={{
        marginTop: 6,
        borderRadius: 10,
        border: isActive
          ? `2px solid ${C.purple}`
          : isFail
          ? `1px solid rgba(229,72,77,.25)`
          : `1px solid ${C.border}`,
        background: isActive
          ? C.purpleBg2
          : isFail
          ? C.redBg
          : C.surface,
        padding: "10px 12px",
        cursor: "pointer",
        transition: "all .15s",
        boxShadow: isActive ? `0 0 0 3px rgba(91,87,209,.12)` : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {/* Status indicator */}
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          {isRunning ? (
            <PulsingDot color={C.purple} />
          ) : tc.status === "Pass" ? (
            <CheckCircle color={C.green} />
          ) : (
            <XCircle color={C.red} />
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 10.5, fontFamily: "monospace", color: isActive ? C.purple : C.textFaint, fontWeight: 600 }}>
              {tc.testId}
            </span>
            {isRunning && (
              <span style={{ fontSize: 10, color: isPaused ? "#ca8a04" : C.purple, background: isPaused ? "#fefce8" : C.purpleBg, padding: "1px 6px", borderRadius: 999, fontWeight: 500 }}>
                {isPaused ? "일시정지" : "실행 중"}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12.5, color: isFail ? C.red : C.textPrimary, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>
            {tc.scenario}
          </p>
          {tc.failReason && (
            <p style={{ marginTop: 5, fontSize: 11, color: "#c5341b", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>
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
    <div style={{ height: "100%", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,.10)", border: `1px solid ${C.borderDark}`, display: "flex", flexDirection: "column", background: C.terminal }}>
      {/* Browser chrome */}
      <div style={{ background: "#2a2a30", padding: "9px 14px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {/* Traffic lights */}
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ff5f57" }} />
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#febc2e" }} />
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#28c840" }} />
        </div>
        {/* URL bar */}
        <div style={{ flex: 1, background: "#1a1a1e", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#71717a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {tc?.videoUrl ? "recorded session" : "대기 중…"}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", background: C.terminal }}>
        {tc?.videoUrl ? (
          <video
            ref={videoRef}
            key={tc.videoUrl}
            src={tc.videoUrl}
            controls
            autoPlay
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : tc?.screenshotUrl ? (
          <img
            src={tc.screenshotUrl}
            alt="screenshot"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : (
          <div style={{
            position: "absolute", inset: 0,
            background: "repeating-linear-gradient(135deg,#202024,#202024 12px,#1a1a1e 12px,#1a1a1e 24px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 12, color: "#52525b", background: "rgba(26,26,30,.9)", padding: "6px 14px", borderRadius: 8 }}>
              {tc?.status === "Pending" ? "녹화 중…" : "미디어 없음"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Terminal logs panel ────────────────────────────────────────────────────
function TerminalPanel({ tc, isPaused }: { tc: TestCase | null; isPaused: boolean }) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const isRunning = tc?.status === "Pending";

  useEffect(() => {
    if (isRunning) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [tc?.consoleLogs?.length, isRunning]);

  return (
    <div style={{ flex: 1, borderRadius: 10, border: `1px solid ${C.terminalBorder}`, background: C.terminal, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Terminal header */}
      <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.terminalBorder}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#52525b", letterSpacing: "0.05em", textTransform: "uppercase" }}>실행 로그</span>
        {isRunning && <PulsingDot color={C.purple} />}
      </div>

      {/* Log lines */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", fontFamily: "monospace", fontSize: 12 }}>
        {!tc ? (
          <span style={{ color: "#3a3a42" }}>시나리오를 선택하면 로그가 표시됩니다.</span>
        ) : (
          <>
            {tc.failReason && (
              <div style={{ display: "flex", gap: 8, marginBottom: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(229,72,77,.08)", border: `1px solid rgba(229,72,77,.2)` }}>
                <span style={{ color: C.red, flexShrink: 0 }}>✗</span>
                <span style={{ color: "#e5797d", lineHeight: 1.5 }}>{tc.failReason}</span>
              </div>
            )}
            {(tc.consoleLogs ?? []).length === 0 && !isRunning && (
              <span style={{ color: "#3a3a42" }}>로그 없음</span>
            )}
            {tc.consoleLogs?.map((log, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "2px 0", lineHeight: 1.6 }}>
                <span style={{ color: "#3a3a42", flexShrink: 0, userSelect: "none" }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ color: "#9a9aa3" }}>{log}</span>
              </div>
            ))}
            {isRunning && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, color: isPaused ? "#ca8a04" : C.purple }}>
                {isPaused
                  ? <><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ca8a04", display: "inline-block" }} /><span style={{ fontSize: 11 }}>일시정지됨</span></>
                  : <><BlinkingCursor /><span style={{ fontSize: 11 }}>분석 중…</span></>
                }
              </div>
            )}
            <div ref={logEndRef} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Small atoms ────────────────────────────────────────────────────────────
function SideIcon({ children, title, href }: { children: React.ReactNode; title: string; href?: string }) {
  const style: React.CSSProperties = {
    width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center",
    justifyContent: "center", color: C.textLight, cursor: "pointer",
    transition: "background .15s, color .15s",
  };
  if (href) return (
    <Link href={href} title={title} style={{ ...style, textDecoration: "none" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.bgAlt2; (e.currentTarget as HTMLElement).style.color = C.purple; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = C.textLight; }}>
      {children}
    </Link>
  );
  return (
    <div title={title} style={style}
      onMouseEnter={e => { e.currentTarget.style.background = C.bgAlt2; e.currentTarget.style.color = C.purple; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textLight; }}>
      {children}
    </div>
  );
}

function SummaryChip({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: 8, padding: "7px 10px", display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: 10.5, color: C.textFaint }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color, letterSpacing: "-0.5px" }}>{value}</span>
    </div>
  );
}

function CtrlButton({ children, onClick, variant }: { children: React.ReactNode; onClick: () => void; variant: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: { background: C.purple, color: "#fff", border: `1px solid ${C.purpleDark}` },
    ghost:   { background: C.surface, color: C.textMid, border: `1px solid ${C.borderMid}` },
    danger:  { background: "#fff0f0", color: C.red, border: `1px solid rgba(229,72,77,.25)` },
  }[variant];
  return (
    <button onClick={onClick} style={{ ...styles, flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
      {children}
    </button>
  );
}

function RunStatusBadge({ status, paused }: { status: RunStatus; paused?: boolean }) {
  if (status === "running" && paused) {
    return <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 999, background: "#fefce8", color: "#a16207" }}>일시정지</span>;
  }
  const map = {
    running:   { bg: C.purpleBg2, color: C.purple, label: "실행 중" },
    completed: { bg: C.greenBg,   color: C.green,  label: "완료" },
    failed:    { bg: C.redBg,     color: C.red,    label: "오류" },
  };
  const { bg, color, label } = map[status];
  return <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 999, background: bg, color }}>{label}</span>;
}

function CaseStatusBadge({ status }: { status: "Pass" | "Fail" }) {
  return status === "Pass"
    ? <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: C.greenBg, color: C.green }}>Pass</span>
    : <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: C.redBg, color: C.red }}>Fail</span>;
}

function PulsingDot({ color }: { color: string }) {
  return (
    <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: color, animation: "pulse 1.4s ease-in-out infinite", flexShrink: 0 }} />
  );
}

function BlinkingCursor() {
  return <span style={{ display: "inline-block", width: 7, height: 13, background: C.purple, borderRadius: 1, animation: "blink 1s step-end infinite" }} />;
}

function CheckCircle({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7.5" fill={color} fillOpacity=".15" stroke={color} strokeWidth="1"/>
      <path d="M5 8l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function XCircle({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7.5" fill={color} fillOpacity=".1" stroke={color} strokeWidth="1"/>
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function LoadingScreen() {
  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: C.purple, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>Q</span>
        </div>
        <p style={{ fontSize: 13, color: C.textFaint }}>불러오는 중…</p>
      </div>
    </div>
  );
}

function ErrorScreen({ msg }: { msg: string }) {
  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: C.bg }}>
      <div style={{ maxWidth: 360, padding: "20px 24px", borderRadius: 12, border: `1px solid rgba(229,72,77,.25)`, background: C.redBg, fontSize: 13, color: C.red }}>
        {msg}
      </div>
    </div>
  );
}

// ── Global animation keyframes (injected once) ─────────────────────────────
if (typeof document !== "undefined") {
  const id = "__qa_keyframes";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
      @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
    `;
    document.head.appendChild(s);
  }
}
