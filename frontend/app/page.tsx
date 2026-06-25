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

/* ─── 글래스 카드 공통 스타일 ─────────────────────────────────── */
const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.55)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.7)",
  borderRadius: 14,
  boxShadow: "0 4px 24px rgba(99,102,241,0.07)",
};

/* ─── 솔리드 카드 (데이터 영역) ───────────────────────────────── */
const solidCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  border: "1px solid rgba(229,231,235,0.8)",
  borderRadius: 14,
  boxShadow: "0 2px 16px rgba(99,102,241,0.05)",
};

export default function HomePage() {
  const router = useRouter();

  const { data: runs = [], isLoading } = useSWR<RunSummary[]>(
    "/api/history",
    fetcher,
    { refreshInterval: 5000 }
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── 상단 헤더 (글래스) ───────────────────────────────────── */}
      <header style={{
        ...glassCard,
        borderRadius: 0,
        borderLeft: "none",
        borderRight: "none",
        borderTop: "none",
        borderBottom: "1px solid rgba(255,255,255,0.6)",
        padding: "0 28px",
        height: 54,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        boxShadow: "0 4px 20px rgba(99,102,241,0.06)",
      }}>
        {/* 브레드크럼 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#a5b4fc", fontWeight: 500 }}>QAgent</span>
          <span style={{ fontSize: 12, color: "#d1d5db" }}>/</span>
          <span style={{ fontSize: 12, color: "#4338ca", fontWeight: 600 }}>대시보드</span>
        </div>

        {/* 새 테스트 버튼 */}
        <Link
          href="/new"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 16px", borderRadius: 8,
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none",
            boxShadow: "0 2px 10px rgba(99,102,241,0.3)",
            transition: "opacity .15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          새 테스트
        </Link>
      </header>

      {/* ── 메인 컨텐츠 ─────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: "28px 28px", overflowY: "auto" }}>
        {isLoading ? (
          <LoadingState />
        ) : runs.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* 통계 카드 4개 (글래스) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
              {[
                { label: "전체 실행", value: runs.length, color: "#4338ca", bg: "rgba(99,102,241,0.1)", icon: "📊" },
                { label: "완료", value: runs.filter((r) => r.status === "completed").length, color: "#059669", bg: "rgba(16,185,129,0.08)", icon: "✅" },
                { label: "실패 포함", value: runs.filter((r) => r.failed > 0).length, color: "#dc2626", bg: "rgba(239,68,68,0.08)", icon: "⚠️" },
                { label: "진행 중", value: runs.filter((r) => r.status === "running").length, color: "#2563eb", bg: "rgba(59,130,246,0.08)", icon: "▶" },
              ].map(({ label, value, color, bg, icon }) => (
                <div key={label} style={{ ...glassCard, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>
                    <span style={{ fontSize: 16, width: 32, height: 32, borderRadius: 8, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
                  </div>
                  <p style={{ fontSize: 26, fontWeight: 700, color, letterSpacing: "-0.8px", lineHeight: 1 }}>{value}</p>
                </div>
              ))}
            </div>

            {/* 섹션 타이틀 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "#374151", letterSpacing: "0.04em", textTransform: "uppercase" }}>최근 실행 이력</h2>
              <span style={{ fontSize: 12, color: "#9ca3af", background: "rgba(255,255,255,0.6)", padding: "2px 10px", borderRadius: 99, border: "1px solid rgba(229,231,235,0.8)" }}>{runs.length}개 항목</span>
            </div>

            {/* 이력 테이블 (솔리드) */}
            <div style={{ ...solidCard, overflow: "hidden" }}>
              {/* 테이블 헤더 */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "130px 1fr 110px 100px 130px 90px",
                padding: "11px 22px",
                background: "rgba(249,250,251,0.9)",
                borderBottom: "1px solid rgba(229,231,235,0.6)",
              }}>
                {["상태", "프로젝트 (URL)", "실행자", "결과 요약", "실행 일시", "모드"].map((h) => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</span>
                ))}
              </div>

              {runs.map((run, i) => (
                <HistoryRow
                  key={run.runId}
                  run={run}
                  isLast={i === runs.length - 1}
                  onClick={() => router.push(`/dashboard/${run.runId}`)}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* ─── 테이블 행 ──────────────────────────────────────────────── */
function HistoryRow({ run, isLast, onClick }: { run: RunSummary; isLast: boolean; onClick: () => void }) {
  const passRate = run.total > 0 ? `${run.passed}/${run.total}` : "—";
  const allPass  = run.passed === run.total && run.total > 0;
  const hasFail  = run.failed > 0;

  const badge = (() => {
    if (run.status === "running") return { label: "실행 중",   bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe", dot: true };
    if (hasFail)                  return { label: "Fail 포함", bg: "#fef2f2", color: "#dc2626", border: "#fecaca", dot: false };
    if (run.status === "failed")  return { label: "오류",      bg: "#fef2f2", color: "#dc2626", border: "#fecaca", dot: false };
    return                               { label: "Pass",      bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", dot: false };
  })();

  const hostname = (() => {
    try { return new URL(run.targetUrl || "").hostname; } catch { return run.targetUrl || "—"; }
  })();

  return (
    <div
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "130px 1fr 110px 100px 130px 90px",
        padding: "14px 22px",
        alignItems: "center",
        borderBottom: isLast ? "none" : "1px solid rgba(229,231,235,0.5)",
        cursor: "pointer",
        transition: "background .12s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(238,242,255,0.4)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* 상태 배지 */}
      <div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99,
          background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
        }}>
          {badge.dot && (
            <span style={{
              width: 5, height: 5, borderRadius: "50%", background: badge.color,
              animation: "pulse 1.4s ease-in-out infinite", display: "inline-block",
            }} />
          )}
          {badge.label}
        </span>
      </div>

      {/* URL */}
      <div style={{ minWidth: 0, paddingRight: 16 }}>
        <p style={{ fontSize: 13, color: "#111827", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hostname}</p>
        {run.targetUrl && (
          <p style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{run.targetUrl}</p>
        )}
      </div>

      {/* 실행자 */}
      <div>
        {run.executor
          ? <span style={{ fontSize: 12, color: "#4b5563", background: "#f3f4f6", padding: "2px 8px", borderRadius: 6, border: "1px solid #e5e7eb" }}>{run.executor}</span>
          : <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span>}
      </div>

      {/* 결과 요약 */}
      <div>
        <span style={{ fontSize: 14, fontWeight: 700, color: hasFail ? "#dc2626" : allPass ? "#16a34a" : "#6b7280" }}>{passRate}</span>
        {run.total > 0 && <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 4 }}>Pass</span>}
      </div>

      {/* 날짜 */}
      <div>
        <p style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>
          {new Date(run.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
        </p>
        <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
          {new Date(run.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {/* 모드 */}
      <div>
        <span style={{
          fontSize: 11, color: "#6366f1", background: "#eef2ff",
          padding: "2px 8px", borderRadius: 6, border: "1px solid #c7d2fe", fontWeight: 500,
        }}>
          {run.mode === "natural" ? "자연어" : "엑셀"}
        </span>
      </div>
    </div>
  );
}

/* ─── Loading ─────────────────────────────────────────────────── */
function LoadingState() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #e0e7ff", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ fontSize: 13, color: "#9ca3af" }}>이력을 불러오는 중…</p>
      </div>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "62vh", textAlign: "center" }}>

      {/* 아이콘 컨테이너 */}
      <div style={{
        ...glassCard,
        width: 88, height: 88, borderRadius: 24,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 28,
        background: "rgba(238,242,255,0.7)",
        border: "1px solid rgba(199,210,254,0.6)",
        boxShadow: "0 8px 32px rgba(99,102,241,0.12)",
      }}>
        <svg width="38" height="38" fill="none" stroke="#818cf8" strokeWidth="1.5" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7"/>
          <path d="M16.5 16.5L21 21" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 11h6M11 8v6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1e1b4b", letterSpacing: "-0.5px", marginBottom: 10 }}>
        아직 실행된 테스트 이력이 없습니다.
      </h2>
      <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7, marginBottom: 32, maxWidth: 360 }}>
        첫 번째 QA 시나리오를 작성하고<br />
        자동화 파이프라인을 구축해 보세요.
      </p>

      {/* CTA 버튼 */}
      <Link
        href="/new"
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "12px 28px", borderRadius: 12,
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          color: "#fff", fontSize: 14, fontWeight: 700,
          textDecoration: "none", letterSpacing: "-0.2px",
          boxShadow: "0 4px 20px rgba(99,102,241,0.35)",
          transition: "all .15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(99,102,241,0.45)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.35)"; }}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M7.5 1v13M1 7.5h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        첫 테스트 생성하기
      </Link>

      <p style={{ fontSize: 12, color: "#c7d2fe", marginTop: 18 }}>
        자연어로 시나리오 작성 또는 엑셀 업로드로 시작
      </p>

      {/* 데코레이션 카드들 */}
      <div style={{ display: "flex", gap: 12, marginTop: 40 }}>
        {["로그인 플로우 테스트", "회원가입 시나리오", "결제 프로세스 검증"].map((text, i) => (
          <div key={i} style={{
            ...glassCard,
            padding: "10px 16px",
            fontSize: 12, color: "#6366f1", fontWeight: 500,
            opacity: 0.5 + i * 0.15,
            transform: `rotate(${(i - 1) * 1.5}deg)`,
          }}>
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}
