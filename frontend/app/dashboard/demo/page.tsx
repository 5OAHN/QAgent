"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type CaseStatus = "Pass" | "Fail" | "Pending";

interface TestCase {
  testId: string;
  feature: string;
  scenario: string;
  status: CaseStatus;
  failReason: string;
  videoUrl: string;
  screenshotUrl: string;
  consoleLogs: string[];
}

const MOCK_SCENARIOS = [
  "해당 링크에 접속하여 로그인 페이지를 확인한다",
  "아이디와 비밀번호를 입력하고 로그인 버튼을 클릭한다",
  "메인 대시보드가 정상적으로 표시되는지 확인한다",
  "상단 메뉴에서 설정 페이지로 이동한다",
];

const MOCK_STEPS = [
  "navigate 메인 페이지로 이동 — 테스트 시작을 위해 URL로 직접 이동합니다",
  "screenshot 현재 화면 캡처 — 페이지 로딩 상태를 확인합니다",
  "click 로그인 버튼 클릭 — 로그인 폼을 열기 위해 버튼을 클릭합니다",
  "type 아이디 입력 — 테스트 계정 아이디를 입력합니다",
  "type 비밀번호 입력 — 보안을 위해 마스킹 처리된 비밀번호를 입력합니다",
  "click 로그인 제출 — 입력한 정보로 로그인을 시도합니다",
  "screenshot 결과 확인 — 로그인 성공 여부를 스크린샷으로 확인합니다",
  "assert 대시보드 노출 확인 — 메인 화면이 올바르게 표시되는지 검증합니다",
];

const C = {
  purple: "#0099ff",
  purpleBg: "rgba(0,153,255,.12)",
  green: "#4ade80",
  greenBg: "rgba(74,222,128,.08)",
  red: "#f87171",
  redBg: "rgba(248,113,113,.08)",
  bg: "#090909",
  bgAlt: "#0d0d0d",
  surface: "#141414",
  border: "#1a1a1a",
  borderMid: "#262626",
  textPrimary: "#ffffff",
  textMid: "#999999",
  textFaint: "#555555",
  terminal: "#0a0a0a",
  terminalBorder: "#1a1a1a",
};

export default function DemoPage() {
  const router = useRouter();
  const [cases, setCases] = useState<TestCase[]>(
    MOCK_SCENARIOS.map((s, i) => ({
      testId: `V-${String(i + 1).padStart(3, "0")}`,
      feature: "데모",
      scenario: s,
      status: "Pending" as CaseStatus,
      failReason: "",
      videoUrl: "",
      screenshotUrl: "",
      consoleLogs: [],
    }))
  );
  const [activeIdx, setActiveIdx] = useState(0);
  const [runningCase, setRunningCase] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const pausedRef = useRef(false);

  // 스텝 시뮬레이션
  useEffect(() => {
    if (isFinished) return;

    const interval = setInterval(() => {
      if (pausedRef.current) return;

      setCases((prev) => {
        const next = [...prev];
        const tc = { ...next[runningCase] };

        if (stepIdx < MOCK_STEPS.length - 1) {
          // 스텝 추가
          const newLog = `[Step ${stepIdx + 1}] ${MOCK_STEPS[stepIdx]}`;
          tc.consoleLogs = [...tc.consoleLogs, newLog];
          next[runningCase] = tc;
          setStepIdx((s) => s + 1);
        } else {
          // 케이스 완료
          const pass = runningCase !== 2; // 케이스3만 Fail 시뮬레이션
          tc.status = pass ? "Pass" : "Fail";
          tc.failReason = pass ? "" : "요소를 찾을 수 없습니다: [data-testid='dashboard-title']";
          tc.consoleLogs = [...tc.consoleLogs, `[Step ${stepIdx + 1}] ${MOCK_STEPS[stepIdx]}`];
          next[runningCase] = tc;

          if (runningCase < MOCK_SCENARIOS.length - 1) {
            setRunningCase((r) => r + 1);
            setActiveIdx(runningCase + 1);
            setStepIdx(0);
          } else {
            setIsFinished(true);
          }
        }
        return next;
      });
    }, 800);

    return () => clearInterval(interval);
  }, [runningCase, stepIdx, isFinished]);

  // 실행 중인 케이스 자동 선택
  useEffect(() => {
    if (!isFinished) setActiveIdx(runningCase);
  }, [runningCase, isFinished]);

  const activeCase = cases[activeIdx];
  const passed = cases.filter((c) => c.status === "Pass").length;
  const failed = cases.filter((c) => c.status === "Fail").length;
  const done = passed + failed;
  const progress = Math.round((done / cases.length) * 100);

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", overflow: "hidden" }}>

      {/* 데모 배너 */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(0,153,255,.12)", borderBottom: "1px solid rgba(0,153,255,.2)", padding: "6px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: C.purple }}>👁 데모 모드 — 실제 테스트가 아닌 시뮬레이션입니다</span>
        <Link href="/" style={{ fontSize: 11, color: C.textMid, textDecoration: "none" }}>실제 테스트 시작 →</Link>
      </div>

      {/* Left sidebar */}
      <aside style={{ width: 56, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 52, paddingBottom: 16, flexShrink: 0, gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: C.purple, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Q</span>
        </div>
        <div style={{ flex: 1 }} />
        <Link href="/" style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: C.textFaint, textDecoration: "none" }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
        </Link>
      </aside>

      {/* Middle panel */}
      <div style={{ width: 340, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0, paddingTop: 32 }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.3px" }}>실행 결과</h1>
              <p style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>데모 · demo-0000</p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 999, background: isFinished ? C.greenBg : C.purpleBg, color: isFinished ? C.green : C.purple }}>
              {isFinished ? "완료" : isPaused ? "일시정지" : "실행 중"}
            </span>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textFaint, marginBottom: 5 }}>
              <span>{done} / {cases.length} 케이스</span>
              <span style={{ color: C.purple, fontWeight: 600 }}>{progress}%</span>
            </div>
            <div style={{ height: 4, background: "#1a1a1a", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: C.purple, borderRadius: 999, transition: "width 0.5s ease" }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {[["전체", cases.length, C.textPrimary, "#141414"], ["Pass", passed, C.green, C.greenBg], ["Fail", failed, C.red, C.redBg]].map(([label, val, color, bg]) => (
              <div key={label as string} style={{ background: bg as string, borderRadius: 8, padding: "7px 10px" }}>
                <div style={{ fontSize: 10.5, color: C.textFaint }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: color as string }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        {!isFinished && (
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 6 }}>
            <button
              onClick={() => { setIsPaused((p) => { pausedRef.current = !p; return !p; }); }}
              style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: `1px solid ${C.borderMid}`, background: isPaused ? C.purple : C.surface, color: isPaused ? "#fff" : C.textMid, fontSize: 12, fontWeight: 500, cursor: "pointer" }}
            >
              {isPaused ? "▶ 재개" : "⏸ 일시정지"}
            </button>
            <button
              onClick={() => router.push("/")}
              style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: "1px solid rgba(248,113,113,.25)", background: "rgba(248,113,113,.08)", color: C.red, fontSize: 12, fontWeight: 500, cursor: "pointer" }}
            >
              ■ 중지
            </button>
          </div>
        )}

        {isPaused && (
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}` }}>
            <button
              onClick={() => router.push("/")}
              style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: `1px solid ${C.borderMid}`, background: C.surface, color: C.textMid, fontSize: 12, fontWeight: 500, cursor: "pointer" }}
            >
              ✏️ 시나리오 수정 후 재시도 ↩
            </button>
          </div>
        )}

        <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textMid }}>
            시나리오
            <span style={{ marginLeft: 6, background: "#1a1a1a", color: C.textFaint, borderRadius: 999, padding: "1px 7px", fontSize: 11, fontWeight: 500 }}>{cases.length}</span>
          </span>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 16px" }}>
          {cases.map((tc, i) => {
            const isActive = i === activeIdx;
            const isFail = tc.status === "Fail";
            const isRunning = tc.status === "Pending" && i === runningCase && !isFinished;
            return (
              <div key={tc.testId} onClick={() => setActiveIdx(i)} style={{ marginTop: 6, borderRadius: 10, border: isActive ? `2px solid ${C.purple}` : isFail ? "1px solid rgba(248,113,113,.25)" : `1px solid ${C.border}`, background: isActive ? C.purpleBg : isFail ? C.redBg : C.surface, padding: "10px 12px", cursor: "pointer", boxShadow: isActive ? `0 0 0 3px rgba(0,153,255,.12)` : "none" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flexShrink: 0, marginTop: 2 }}>
                    {isRunning ? (
                      <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: C.purple, animation: "pulse 1.4s ease-in-out infinite" }} />
                    ) : tc.status === "Pass" ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7.5" fill={C.green} fillOpacity=".15" stroke={C.green} strokeWidth="1"/><path d="M5 8l2 2 4-4" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    ) : tc.status === "Fail" ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7.5" fill={C.red} fillOpacity=".1" stroke={C.red} strokeWidth="1"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke={C.red} strokeWidth="1.5" strokeLinecap="round"/></svg>
                    ) : (
                      <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#333" }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, fontFamily: "monospace", color: isActive ? C.purple : C.textFaint, marginBottom: 3 }}>{tc.testId}</div>
                    <p style={{ fontSize: 12.5, color: isFail ? C.red : C.textPrimary, lineHeight: 1.45 }}>{tc.scenario}</p>
                    {tc.failReason && <p style={{ marginTop: 5, fontSize: 11, color: "#f87171", opacity: 0.8 }}>{tc.failReason}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bgAlt, paddingTop: 32 }}>
        {/* Top bar */}
        <div style={{ padding: "12px 20px", background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {activeCase ? (
            <>
              <span style={{ fontSize: 11, fontFamily: "monospace", color: C.textFaint, background: "#1a1a1a", padding: "2px 8px", borderRadius: 5 }}>{activeCase.testId}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeCase.scenario}</span>
              {activeCase.status !== "Pending" && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: activeCase.status === "Pass" ? C.greenBg : C.redBg, color: activeCase.status === "Pass" ? C.green : C.red }}>
                  {activeCase.status}
                </span>
              )}
            </>
          ) : null}
        </div>

        {/* Browser mockup */}
        <div style={{ flex: "0 0 56%", padding: "16px 20px 8px", minHeight: 0 }}>
          <div style={{ height: "100%", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,.3)", border: "1px solid #333", display: "flex", flexDirection: "column", background: "#0a0a0a" }}>
            <div style={{ background: "#2a2a30", padding: "9px 14px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ff5f57" }} />
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#febc2e" }} />
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#28c840" }} />
              </div>
              <div style={{ flex: 1, background: "#1a1a1e", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#71717a" }}>
                {activeCase?.status === "Pending" ? "녹화 중..." : "recorded session"}
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              {activeCase?.status === "Pending" && activeIdx === runningCase ? (
                <LiveStepMock logs={activeCase.consoleLogs} isPaused={isPaused} />
              ) : (
                <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(135deg,#202024,#202024 12px,#1a1a1e 12px,#1a1a1e 24px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 12, color: "#555", background: "rgba(0,0,0,.6)", padding: "6px 14px", borderRadius: 8 }}>
                    {activeCase?.status === "Pass" ? "✅ 테스트 통과" : activeCase?.status === "Fail" ? "❌ 테스트 실패" : "대기 중"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Terminal */}
        <div style={{ flex: 1, padding: "0 20px 16px", minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, borderRadius: 10, border: `1px solid ${C.terminalBorder}`, background: C.terminal, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.terminalBorder}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#52525b", letterSpacing: "0.05em", textTransform: "uppercase" }}>실행 로그</span>
              {activeCase?.status === "Pending" && activeIdx === runningCase && !isPaused && (
                <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: C.purple, animation: "pulse 1.4s ease-in-out infinite" }} />
              )}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", fontFamily: "monospace", fontSize: 12 }}>
              {activeCase?.failReason && (
                <div style={{ display: "flex", gap: 8, marginBottom: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.2)" }}>
                  <span style={{ color: C.red, flexShrink: 0 }}>✗</span>
                  <span style={{ color: "#e5797d" }}>{activeCase.failReason}</span>
                </div>
              )}
              {activeCase?.consoleLogs.map((log, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "2px 0", lineHeight: 1.6 }}>
                  <span style={{ color: "#3a3a42", flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ color: "#9a9aa3" }}>{log}</span>
                </div>
              ))}
              {activeCase?.status === "Pending" && activeIdx === runningCase && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, color: isPaused ? "#ca8a04" : C.purple }}>
                  <span style={{ display: "inline-block", width: 7, height: 13, background: isPaused ? "#ca8a04" : C.purple, borderRadius: 1, animation: "blink 1s step-end infinite" }} />
                  <span style={{ fontSize: 11 }}>{isPaused ? "일시정지됨" : "분석 중…"}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin { from{stroke-dashoffset:150.8} to{stroke-dashoffset:0} }
      `}</style>
    </div>
  );
}

function LiveStepMock({ logs, isPaused }: { logs: string[]; isPaused: boolean }) {
  const lastLog = logs[logs.length - 1] ?? null;
  const parseStep = (log: string) => {
    const m = log.match(/^\[Step (\d+)\] (.+?) (.+) — (.+)$/);
    if (m) return { num: m[1], action: m[2], details: m[3], thought: m[4] };
    return { num: "?", action: log, details: "", thought: "" };
  };
  const current = lastLog ? parseStep(lastLog) : null;

  return (
    <div style={{ position: "absolute", inset: 0, background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 20 }}>
      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.05)", padding: "4px 10px", borderRadius: 999 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f87171", display: "inline-block", animation: isPaused ? "none" : "pulse 1s ease-in-out infinite" }} />
        <span style={{ fontSize: 11, color: "#555", fontFamily: "monospace" }}>{isPaused ? "PAUSE" : "REC"}</span>
      </div>
      <div style={{ position: "relative", width: 56, height: 56 }}>
        <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="28" cy="28" r="24" fill="none" stroke="#1a1a1a" strokeWidth="3" />
          <circle cx="28" cy="28" r="24" fill="none" stroke="#0099ff" strokeWidth="3" strokeDasharray="150.8" strokeDashoffset="0" style={{ animation: isPaused ? "none" : "spin 1.5s linear infinite" }} />
        </svg>
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#0099ff", fontFamily: "monospace" }}>{logs.length}</span>
      </div>
      {current ? (
        <div style={{ textAlign: "center", maxWidth: 480, width: "100%" }}>
          <div style={{ fontSize: 11, color: "#444", fontFamily: "monospace", marginBottom: 6 }}>STEP {current.num}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#ccc", marginBottom: 8 }}>{current.action} {current.details}</div>
          {current.thought && (
            <div style={{ fontSize: 12, color: "#555", background: "#111", borderRadius: 8, padding: "8px 12px", textAlign: "left" }}>💭 {current.thought}</div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "#444" }}>에이전트 초기화 중…</div>
      )}
      {logs.length > 0 && (
        <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 3 }}>
          {logs.slice(-5).map((log, i) => {
            const isLast = i === Math.min(logs.length, 5) - 1;
            const s = parseStep(log);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, opacity: isLast ? 1 : 0.3 }}>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: isLast ? "#0099ff" : "#333", flexShrink: 0 }}>{String(logs.length - (Math.min(logs.length, 5) - 1 - i)).padStart(2, "0")}</span>
                <span style={{ fontSize: 11, color: isLast ? "#999" : "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.action} {s.details}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
