"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";

interface RunSummary {
  runId: string;
  status: "running" | "completed" | "failed";
  total: number;
  passed: number;
  failed: number;
  createdAt: string;
  mode: "excel" | "natural";
  targetUrl?: string;
  executor?: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function HomePage() {
  const router = useRouter();

  const { data: runs = [], isLoading } = useSWR<RunSummary[]>(
    "/api/history",
    fetcher,
    { refreshInterval: 5000 }
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

      {/* 페이지 헤더 (브레드크럼) */}
      <header style={{ borderBottom: "1px solid #1a1a1a", padding: "0 28px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "#333" }}>QAgent</span>
          <span style={{ fontSize: 11, color: "#2a2a2a" }}>/</span>
          <span style={{ fontSize: 11, color: "#777" }}>대시보드</span>
        </div>
        <Link
          href="/new"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 7, background: "#0099ff", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          새 테스트
        </Link>
      </header>

      {/* 본문 */}
      <main style={{ flex: 1, padding: "28px 28px", overflowY: "auto" }}>
        {isLoading ? (
          <LoadingState />
        ) : runs.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* 통계 카드 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
              {[
                { label: "전체 실행", value: runs.length, color: "#fff" },
                { label: "완료", value: runs.filter((r) => r.status === "completed").length, color: "#4ade80" },
                { label: "실패 포함", value: runs.filter((r) => r.failed > 0).length, color: "#f87171" },
                { label: "진행 중", value: runs.filter((r) => r.status === "running").length, color: "#0099ff" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "#141414", border: "1px solid #1a1a1a", borderRadius: 10, padding: "14px 18px" }}>
                  <p style={{ fontSize: 11, color: "#555", marginBottom: 6 }}>{label}</p>
                  <p style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: "-0.5px" }}>{value}</p>
                </div>
              ))}
            </div>

            {/* 섹션 타이틀 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ fontSize: 12, fontWeight: 600, color: "#444", letterSpacing: "0.06em", textTransform: "uppercase" }}>최근 실행 이력</h2>
              <span style={{ fontSize: 11, color: "#333" }}>{runs.length}개 항목</span>
            </div>

            {/* 테이블 */}
            <div style={{ border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden" }}>
              {/* 헤더 */}
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 110px 100px 120px 100px", background: "#111", padding: "10px 20px", borderBottom: "1px solid #1a1a1a" }}>
                {["상태", "프로젝트 (URL)", "실행자", "결과 요약", "실행 일시", "모드"].map((h) => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#444", letterSpacing: "0.03em" }}>{h}</span>
                ))}
              </div>
              {runs.map((run, i) => (
                <HistoryRow key={run.runId} run={run} isLast={i === runs.length - 1} onClick={() => router.push(`/dashboard/${run.runId}`)} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function HistoryRow({ run, isLast, onClick }: { run: RunSummary; isLast: boolean; onClick: () => void }) {
  const passRate = run.total > 0 ? `${run.passed}/${run.total}` : "—";
  const allPass  = run.passed === run.total && run.total > 0;
  const hasFail  = run.failed > 0;

  const statusBadge = () => {
    if (run.status === "running") return { label: "실행 중",  bg: "rgba(0,153,255,.12)", color: "#0099ff", dot: true };
    if (hasFail)                  return { label: "Fail 포함", bg: "rgba(248,113,113,.1)", color: "#f87171", dot: false };
    if (run.status === "failed")  return { label: "오류",     bg: "rgba(248,113,113,.1)", color: "#f87171", dot: false };
    return                               { label: "Pass",     bg: "rgba(74,222,128,.08)", color: "#4ade80", dot: false };
  };
  const badge = statusBadge();

  const hostname = (() => {
    try { return new URL(run.targetUrl || "").hostname; } catch { return run.targetUrl || "—"; }
  })();

  return (
    <div
      onClick={onClick}
      style={{ display: "grid", gridTemplateColumns: "120px 1fr 110px 100px 120px 100px", padding: "14px 20px", alignItems: "center", borderBottom: isLast ? "none" : "1px solid #111", cursor: "pointer", transition: "background .12s" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#141414")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: badge.bg, color: badge.color }}>
          {badge.dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: badge.color, animation: "pulse 1.4s infinite", display: "inline-block" }} />}
          {badge.label}
        </span>
      </div>
      <div style={{ minWidth: 0, paddingRight: 16 }}>
        <p style={{ fontSize: 13, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{hostname}</p>
        {run.targetUrl && <p style={{ fontSize: 11, color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{run.targetUrl}</p>}
      </div>
      <div>
        {run.executor
          ? <span style={{ fontSize: 12, color: "#999", background: "#1a1a1a", padding: "2px 8px", borderRadius: 5 }}>{run.executor}</span>
          : <span style={{ fontSize: 12, color: "#333" }}>—</span>}
      </div>
      <div>
        <span style={{ fontSize: 13, fontWeight: 600, color: hasFail ? "#f87171" : allPass ? "#4ade80" : "#999" }}>{passRate}</span>
        {run.total > 0 && <span style={{ fontSize: 11, color: "#444", marginLeft: 4 }}>Pass</span>}
      </div>
      <div>
        <p style={{ fontSize: 12, color: "#777" }}>{new Date(run.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}</p>
        <p style={{ fontSize: 11, color: "#444", marginTop: 1 }}>{new Date(run.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</p>
      </div>
      <div>
        <span style={{ fontSize: 11, color: "#444", background: "#1a1a1a", padding: "2px 7px", borderRadius: 5 }}>{run.mode === "natural" ? "자연어" : "엑셀"}</span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <p style={{ fontSize: 13, color: "#333" }}>불러오는 중…</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", textAlign: "center", gap: 0 }}>
      {/* 아이콘 */}
      <div style={{ width: 72, height: 72, borderRadius: 20, background: "#141414", border: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
        <svg width="32" height="32" fill="none" stroke="#2a2a2a" strokeWidth="1.4" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7"/>
          <path d="M16.5 16.5L21 21" strokeLinecap="round"/>
          <path d="M11 8v3M11 14h.01" strokeLinecap="round"/>
        </svg>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 600, color: "#888", letterSpacing: "-0.4px", marginBottom: 10 }}>
        아직 실행된 테스트 이력이 없습니다.
      </h2>
      <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 28, maxWidth: 340 }}>
        첫 번째 QA 시나리오를 작성하고<br />
        자동화 파이프라인을 구축해 보세요.
      </p>

      <Link
        href="/new"
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 10, background: "#0099ff", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none", letterSpacing: "-0.2px" }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        첫 테스트 생성하기
      </Link>

      <p style={{ fontSize: 11, color: "#2a2a2a", marginTop: 16 }}>
        자연어로 시나리오를 작성하거나 엑셀 파일을 업로드해 시작할 수 있습니다
      </p>
    </div>
  );
}
