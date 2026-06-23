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
  blue:      "#0066cc",
  canvas:    "#ffffff",
  parchment: "#f5f5f7",
  ink:       "#1d1d1f",
  inkMuted:  "#6b7280",
  inkFaint:  "#9ca3af",
  hairline:  "#e0e0e0",
  divider:   "#f0f0f0",
  green:     "#16a34a",
  greenBg:   "#f0fdf4",
  greenBdr:  "#bbf7d0",
  red:       "#dc2626",
  redBg:     "#fef2f2",
  redBdr:    "#fecaca",
  blueBg:    "#eff6ff",
  blueBdr:   "#bfdbfe",
};

const card: React.CSSProperties = {
  background: A.canvas,
  border: `1px solid ${A.hairline}`,
  borderRadius: 18,
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
        borderBottom: `1px solid ${A.hairline}`,
        padding: "0 28px",
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: A.inkFaint }}>QAgent</span>
          <span style={{ fontSize: 13, color: A.hairline }}>/</span>
          <span style={{ fontSize: 13, color: A.ink, fontWeight: 600 }}>대시보드</span>
        </div>

        <Link
          href="/new"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 18px", borderRadius: 9999,
            background: A.blue,
            color: "#fff", fontSize: 14, fontWeight: 400, textDecoration: "none",
            transition: "opacity .15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          새 테스트
        </Link>
      </header>

      {/* 메인 */}
      <main style={{ flex: 1, padding: "28px", overflowY: "auto" }}>
        {isLoading ? (
          <LoadingState />
        ) : runs.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* 통계 카드 4개 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
              {[
                { label: "전체 실행", value: runs.length, color: A.ink },
                { label: "완료", value: runs.filter((r) => r.status === "completed").length, color: A.green },
                { label: "Fail 포함", value: runs.filter((r) => r.failed > 0).length, color: A.red },
                { label: "진행 중", value: runs.filter((r) => r.status === "running").length, color: A.blue },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ ...card, padding: "20px 22px" }}>
                  <p style={{ fontSize: 12, fontWeight: 400, color: A.inkMuted, marginBottom: 10, letterSpacing: "-0.1px" }}>{label}</p>
                  <p style={{ fontSize: 32, fontWeight: 600, color, letterSpacing: "-0.8px", lineHeight: 1 }}>{value}</p>
                </div>
              ))}
            </div>

            {/* 섹션 타이틀 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: A.ink, letterSpacing: "-0.2px" }}>최근 실행 이력</h2>
              <span style={{ fontSize: 12, color: A.inkFaint }}>{runs.length}개</span>
            </div>

            {/* 이력 테이블 */}
            <div style={{ ...card, overflow: "hidden" }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "130px 1fr 110px 100px 130px 90px",
                padding: "10px 22px",
                background: A.parchment,
                borderBottom: `1px solid ${A.hairline}`,
              }}>
                {["상태", "프로젝트 (URL)", "실행자", "결과 요약", "실행 일시", "모드"].map((h) => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 600, color: A.inkFaint, letterSpacing: "0.04em", textTransform: "uppercase" }}>{h}</span>
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
    if (run.status === "running") return { label: "실행 중",   bg: A.blueBg,  color: A.blue,  border: A.blueBdr,  dot: true };
    if (hasFail)                  return { label: "Fail 포함", bg: A.redBg,   color: A.red,   border: A.redBdr,   dot: false };
    if (run.status === "failed")  return { label: "오류",      bg: A.redBg,   color: A.red,   border: A.redBdr,   dot: false };
    return                               { label: "Pass",      bg: A.greenBg, color: A.green, border: A.greenBdr, dot: false };
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
        padding: "13px 22px",
        alignItems: "center",
        borderBottom: isLast ? "none" : `1px solid ${A.divider}`,
        cursor: "pointer",
        transition: "background .1s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = A.parchment)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 9999,
          background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
        }}>
          {badge.dot && (
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: badge.color, animation: "pulse 1.4s ease-in-out infinite", display: "inline-block" }} />
          )}
          {badge.label}
        </span>
      </div>

      <div style={{ minWidth: 0, paddingRight: 16 }}>
        <p style={{ fontSize: 14, color: A.ink, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.2px" }}>{hostname}</p>
        {run.targetUrl && (
          <p style={{ fontSize: 11, color: A.inkFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{run.targetUrl}</p>
        )}
      </div>

      <div>
        {run.executor
          ? <span style={{ fontSize: 12, color: A.inkMuted, background: A.parchment, padding: "2px 8px", borderRadius: 6, border: `1px solid ${A.hairline}` }}>{run.executor}</span>
          : <span style={{ fontSize: 12, color: A.inkFaint }}>—</span>}
      </div>

      <div>
        <span style={{ fontSize: 15, fontWeight: 600, color: hasFail ? A.red : allPass ? A.green : A.inkMuted, letterSpacing: "-0.3px" }}>{passRate}</span>
        {run.total > 0 && <span style={{ fontSize: 11, color: A.inkFaint, marginLeft: 4 }}>Pass</span>}
      </div>

      <div>
        <p style={{ fontSize: 13, color: A.ink, fontWeight: 400, letterSpacing: "-0.2px" }}>
          {new Date(run.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
        </p>
        <p style={{ fontSize: 11, color: A.inkFaint, marginTop: 2 }}>
          {new Date(run.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      <div>
        <span style={{
          fontSize: 11, color: A.blue, background: A.blueBg,
          padding: "2px 8px", borderRadius: 6, border: `1px solid ${A.blueBdr}`, fontWeight: 400,
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
        <div style={{ width: 32, height: 32, border: `2px solid ${A.hairline}`, borderTopColor: A.blue, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ fontSize: 14, color: A.inkFaint }}>이력을 불러오는 중…</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "62vh", textAlign: "center" }}>
      <div style={{
        width: 80, height: 80, borderRadius: 20,
        background: A.parchment,
        border: `1px solid ${A.hairline}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 24,
      }}>
        <svg width="34" height="34" fill="none" stroke={A.blue} strokeWidth="1.4" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7"/>
          <path d="M16.5 16.5L21 21" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 11h6M11 8v6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 600, color: A.ink, letterSpacing: "-0.5px", marginBottom: 10 }}>
        아직 실행된 테스트 이력이 없습니다.
      </h2>
      <p style={{ fontSize: 17, color: A.inkMuted, lineHeight: 1.47, marginBottom: 28, maxWidth: 340, letterSpacing: "-0.374px" }}>
        첫 번째 QA 시나리오를 작성하고<br />
        자동화 파이프라인을 구축해 보세요.
      </p>

      <Link
        href="/new"
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "11px 22px", borderRadius: 9999,
          background: A.blue,
          color: "#fff", fontSize: 17, fontWeight: 400,
          textDecoration: "none", letterSpacing: "-0.374px",
          transition: "opacity .15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        첫 테스트 생성하기
      </Link>

      <p style={{ fontSize: 14, color: A.inkFaint, marginTop: 14, letterSpacing: "-0.2px" }}>
        자연어로 시나리오 작성 또는 엑셀 업로드로 시작
      </p>
    </div>
  );
}
