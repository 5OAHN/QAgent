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

const A = {
  blue:     "#0066cc",
  ink:      "#1d1d1f",
  inkMuted: "#6b7280",
  hairline: "#e0e0e0",
  divider:  "#f0f0f0",
  canvas:   "#ffffff",
  parchment:"#f5f5f7",
};

const card: React.CSSProperties = {
  background: A.canvas,
  border: `1px solid ${A.hairline}`,
  borderRadius: 14,
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

      {/* 헤더 */}
      <header style={{
        background: A.canvas,
        borderBottom: `1px solid ${A.divider}`,
        padding: "0 28px",
        height: 54,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: A.inkMuted, fontWeight: 500 }}>QAgent</span>
          <span style={{ fontSize: 12, color: A.hairline }}>/</span>
          <span style={{ fontSize: 12, color: A.blue, fontWeight: 600 }}>대시보드</span>
        </div>
        <div />
      </header>

      {/* 메인 */}
      <main style={{ flex: 1, padding: "28px", overflowY: "auto", background: A.parchment }}>
        {isLoading ? (
          <LoadingState />
        ) : runs.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* 통계 카드 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
              {[
                { label: "전체 실행", value: runs.length,                                          color: A.blue,    bg: "rgba(0,102,204,0.07)" },
                { label: "완료",      value: runs.filter((r) => r.status === "completed").length,  color: "#16a34a", bg: "rgba(22,163,74,0.07)"  },
                { label: "Fail 포함", value: runs.filter((r) => r.failed > 0).length,              color: "#dc2626", bg: "rgba(220,38,38,0.07)"  },
                { label: "진행 중",   value: runs.filter((r) => r.status === "running").length,    color: "#0066cc", bg: "rgba(0,102,204,0.07)"  },
              ].map(({ label, value, color, bg }) => (
                <div key={label} style={{ ...card, padding: "18px 20px" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: A.inkMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>{label}</p>
                  <p style={{ fontSize: 28, fontWeight: 600, color, letterSpacing: "-0.8px", lineHeight: 1 }}>{value}</p>
                </div>
              ))}
            </div>

            {/* 섹션 타이틀 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: A.ink, letterSpacing: "0.04em", textTransform: "uppercase" }}>최근 실행 이력</h2>
              <span style={{ fontSize: 12, color: A.inkMuted }}>{runs.length}개 항목</span>
            </div>

            {/* 이력 테이블 */}
            <div style={{ ...card, overflow: "hidden" }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "130px 1fr 110px 100px 130px 90px",
                padding: "11px 22px",
                background: A.parchment,
                borderBottom: `1px solid ${A.hairline}`,
              }}>
                {["상태", "프로젝트 (URL)", "실행자", "결과 요약", "실행 일시", "모드"].map((h) => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 600, color: A.inkMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</span>
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

function HistoryRow({ run, isLast, onClick }: { run: RunSummary; isLast: boolean; onClick: () => void }) {
  const passRate = run.total > 0 ? `${run.passed}/${run.total}` : "—";
  const allPass  = run.passed === run.total && run.total > 0;
  const hasFail  = run.failed > 0;

  const badge = (() => {
    if (run.status === "running") return { label: "실행 중",   bg: "#eff6ff", color: "#0066cc", border: "#bfdbfe", dot: true };
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
        borderBottom: isLast ? "none" : `1px solid ${A.divider}`,
        cursor: "pointer",
        transition: "background .12s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = A.parchment)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99,
          background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
        }}>
          {badge.dot && (
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: badge.color, animation: "pulse 1.4s ease-in-out infinite", display: "inline-block" }} />
          )}
          {badge.label}
        </span>
      </div>

      <div style={{ minWidth: 0, paddingRight: 16 }}>
        <p style={{ fontSize: 13, color: A.ink, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hostname}</p>
        {run.targetUrl && (
          <p style={{ fontSize: 11, color: A.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{run.targetUrl}</p>
        )}
      </div>

      <div>
        {run.executor
          ? <span style={{ fontSize: 12, color: A.ink, background: A.parchment, padding: "2px 8px", borderRadius: 6, border: `1px solid ${A.hairline}` }}>{run.executor}</span>
          : <span style={{ fontSize: 12, color: A.inkMuted }}>—</span>}
      </div>

      <div>
        <span style={{ fontSize: 14, fontWeight: 700, color: hasFail ? "#dc2626" : allPass ? "#16a34a" : A.inkMuted }}>{passRate}</span>
        {run.total > 0 && <span style={{ fontSize: 11, color: A.inkMuted, marginLeft: 4 }}>Pass</span>}
      </div>

      <div>
        <p style={{ fontSize: 12, color: A.ink, fontWeight: 500 }}>
          {new Date(run.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
        </p>
        <p style={{ fontSize: 11, color: A.inkMuted, marginTop: 2 }}>
          {new Date(run.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      <div>
        <span style={{
          fontSize: 11, color: A.blue, background: "rgba(0,102,204,0.07)",
          padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(0,102,204,0.15)", fontWeight: 500,
        }}>
          {run.mode === "natural" ? "자연어" : "엑셀"}
        </span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${A.hairline}`, borderTopColor: A.blue, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ fontSize: 13, color: A.inkMuted }}>이력을 불러오는 중…</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "62vh", textAlign: "center" }}>

      <div style={{
        width: 80, height: 80, borderRadius: 20,
        background: "rgba(0,102,204,0.06)",
        border: "1px solid rgba(0,102,204,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 24,
      }}>
        <svg width="36" height="36" fill="none" stroke={A.blue} strokeWidth="1.5" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7"/>
          <path d="M16.5 16.5L21 21" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 11h6M11 8v6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 600, color: A.ink, letterSpacing: "-0.5px", marginBottom: 10 }}>
        아직 실행된 테스트 이력이 없습니다.
      </h2>
      <p style={{ fontSize: 14, color: A.inkMuted, lineHeight: 1.7, marginBottom: 28, maxWidth: 360 }}>
        첫 번째 QA 시나리오를 작성하고<br />
        자동화 파이프라인을 구축해 보세요.
      </p>

      <Link
        href="/new"
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "11px 24px", borderRadius: 9999,
          background: A.blue,
          color: "#fff", fontSize: 14, fontWeight: 600,
          textDecoration: "none", letterSpacing: "-0.2px",
          transition: "background .15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#0055b3"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = A.blue; }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        첫 테스트 생성하기
      </Link>

      <p style={{ fontSize: 12, color: A.inkMuted, marginTop: 16 }}>
        자연어로 시나리오 작성 또는 엑셀 업로드로 시작
      </p>

      <div style={{ display: "flex", gap: 10, marginTop: 36 }}>
        {["로그인 플로우 테스트", "회원가입 시나리오", "결제 프로세스 검증"].map((text, i) => (
          <div key={i} style={{
            background: A.canvas, border: `1px solid ${A.hairline}`,
            borderRadius: 10, padding: "9px 14px",
            fontSize: 12, color: A.inkMuted, fontWeight: 500,
            opacity: 0.5 + i * 0.2,
            transform: `rotate(${(i - 1) * 1.5}deg)`,
          }}>
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}
