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
    <div style={{ minHeight: "100vh", background: "#090909", fontFamily: "-apple-system, BlinkMacSystemFont, 'Geist', sans-serif" }}>

      {/* 헤더 */}
      <header style={{ borderBottom: "1px solid #1a1a1a", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "#0099ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Q</span>
          </div>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 15, letterSpacing: "-0.3px" }}>QAgent</span>
          <span style={{ color: "#333", fontSize: 13, marginLeft: 4 }}>/ 테스트 이력</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/dashboard/demo" style={{ fontSize: 12, color: "#555", textDecoration: "none" }}>UI 미리보기</Link>
          <Link
            href="/new"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 8, background: "#0099ff", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none", letterSpacing: "-0.2px" }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            새 테스트
          </Link>
        </div>
      </header>

      {/* 본문 */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>

        {/* 상단 통계 */}
        {runs.length > 0 && (
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
        )}

        {/* 섹션 타이틀 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#555", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            최근 실행 이력
          </h2>
          {runs.length > 0 && (
            <span style={{ fontSize: 11, color: "#333" }}>{runs.length}개 항목</span>
          )}
        </div>

        {/* 테이블 */}
        {isLoading ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "#333", fontSize: 13 }}>불러오는 중…</div>
        ) : runs.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden" }}>
            {/* 테이블 헤더 */}
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 110px 100px 120px 100px", background: "#111", padding: "10px 20px", borderBottom: "1px solid #1a1a1a" }}>
              {["상태", "프로젝트 (URL)", "실행자", "결과 요약", "실행 일시", "모드"].map((h) => (
                <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#444", letterSpacing: "0.03em" }}>{h}</span>
              ))}
            </div>

            {/* 테이블 행 */}
            {runs.map((run, i) => (
              <HistoryRow key={run.runId} run={run} isLast={i === runs.length - 1} onClick={() => router.push(`/dashboard/${run.runId}`)} />
            ))}
          </div>
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
    if (run.status === "running") return { label: "실행 중", bg: "rgba(0,153,255,.12)", color: "#0099ff", dot: true };
    if (hasFail)                  return { label: "Fail 포함", bg: "rgba(248,113,113,.1)", color: "#f87171", dot: false };
    if (run.status === "failed")  return { label: "오류", bg: "rgba(248,113,113,.1)", color: "#f87171", dot: false };
    return                               { label: "Pass", bg: "rgba(74,222,128,.08)", color: "#4ade80", dot: false };
  };
  const badge = statusBadge();

  const hostname = (() => {
    try { return new URL(run.targetUrl || "").hostname; } catch { return run.targetUrl || "—"; }
  })();

  return (
    <div
      onClick={onClick}
      style={{
        display: "grid", gridTemplateColumns: "120px 1fr 110px 100px 120px 100px",
        padding: "14px 20px", alignItems: "center",
        borderBottom: isLast ? "none" : "1px solid #111",
        cursor: "pointer", transition: "background .12s",
        background: "transparent",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#141414")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* 상태 */}
      <div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: badge.bg, color: badge.color }}>
          {badge.dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: badge.color, animation: "pulse 1.4s ease-in-out infinite", display: "inline-block" }} />}
          {badge.label}
        </span>
      </div>

      {/* URL */}
      <div style={{ minWidth: 0, paddingRight: 16 }}>
        <p style={{ fontSize: 13, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
          {hostname}
        </p>
        {run.targetUrl && (
          <p style={{ fontSize: 11, color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
            {run.targetUrl}
          </p>
        )}
      </div>

      {/* 실행자 */}
      <div>
        {run.executor ? (
          <span style={{ fontSize: 12, color: "#999", background: "#1a1a1a", padding: "2px 8px", borderRadius: 5 }}>
            {run.executor}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "#333" }}>—</span>
        )}
      </div>

      {/* 결과 요약 */}
      <div>
        <span style={{ fontSize: 13, fontWeight: 600, color: hasFail ? "#f87171" : allPass ? "#4ade80" : "#999" }}>
          {passRate}
        </span>
        {run.total > 0 && (
          <span style={{ fontSize: 11, color: "#444", marginLeft: 4 }}>Pass</span>
        )}
      </div>

      {/* 날짜 */}
      <div>
        <p style={{ fontSize: 12, color: "#777" }}>
          {new Date(run.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
        </p>
        <p style={{ fontSize: 11, color: "#444", marginTop: 1 }}>
          {new Date(run.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {/* 모드 */}
      <div>
        <span style={{ fontSize: 11, color: "#444", background: "#1a1a1a", padding: "2px 7px", borderRadius: 5 }}>
          {run.mode === "natural" ? "자연어" : "엑셀"}
        </span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ padding: "80px 24px", textAlign: "center" }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: "#141414", border: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <svg width="20" height="20" fill="none" stroke="#444" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>
      </div>
      <p style={{ fontSize: 14, color: "#555", marginBottom: 6 }}>아직 실행된 테스트가 없습니다</p>
      <p style={{ fontSize: 12, color: "#333", marginBottom: 20 }}>새 테스트를 시작하면 여기에 이력이 쌓입니다</p>
      <Link href="/new" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 8, background: "#0099ff", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
        첫 테스트 시작하기 →
      </Link>
    </div>
  );
}
