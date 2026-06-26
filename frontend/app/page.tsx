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

  const { data: runs = [], isLoading, mutate } = useSWR<RunSummary[]>(
    "/api/history",
    fetcher,
    { refreshInterval: 5000 }
  );

  const handleDelete = async (runId: string) => {
    if (!confirm("이 테스트 이력을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    mutate((prev) => (prev ?? []).filter((r) => r.runId !== runId), { revalidate: false });
    try {
      const res = await fetch(`/api/run/${runId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "삭제에 실패했습니다.");
        mutate();
      }
    } catch {
      alert("Worker에 연결할 수 없습니다.");
      mutate();
    }
  };

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
        ) : (
          <>
            {/* 통계 카드 — 데이터 유무와 상관없이 항상 노출 */}
            <StatsRow runs={runs} />

            {runs.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* 섹션 타이틀 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h2 style={{ fontSize: 13, fontWeight: 600, color: A.ink, letterSpacing: "0.04em", textTransform: "uppercase" }}>최근 실행 이력</h2>
                  <span style={{ fontSize: 12, color: A.inkMuted }}>{runs.length}개 항목</span>
                </div>

                {/* 이력 테이블 */}
                <div style={{ ...card, overflow: "hidden" }}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "130px 1fr 110px 100px 130px 90px 40px",
                    padding: "11px 22px",
                    background: A.parchment,
                    borderBottom: `1px solid ${A.hairline}`,
                  }}>
                    {["상태", "프로젝트 (URL)", "실행자", "결과 요약", "실행 일시", "모드", ""].map((h, i) => (
                      <span key={i} style={{ fontSize: 11, fontWeight: 600, color: A.inkMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</span>
                    ))}
                  </div>
                  {runs.map((run, i) => (
                    <HistoryRow
                      key={run.runId}
                      run={run}
                      isLast={i === runs.length - 1}
                      onClick={() => router.push(`/dashboard/${run.runId}`)}
                      onDelete={() => handleDelete(run.runId)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatsRow({ runs }: { runs: RunSummary[] }) {
  const isEmpty = runs.length === 0;
  const stats = [
    { label: "전체 실행", value: runs.length,                                          color: A.blue,    bg: "rgba(0,102,204,0.07)" },
    { label: "완료",      value: runs.filter((r) => r.status === "completed").length,  color: "#16a34a", bg: "rgba(22,163,74,0.07)"  },
    { label: "Fail 포함", value: runs.filter((r) => r.failed > 0).length,              color: "#dc2626", bg: "rgba(220,38,38,0.07)"  },
    { label: "진행 중",   value: runs.filter((r) => r.status === "running").length,    color: "#0066cc", bg: "rgba(0,102,204,0.07)"  },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
      {stats.map(({ label, value, color, bg }) => (
        <div key={label} style={{ ...card, padding: "18px 20px", opacity: isEmpty ? 0.55 : 1, transition: "opacity .2s" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: A.inkMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>{label}</p>
          <p style={{ fontSize: 28, fontWeight: 600, color: isEmpty ? A.inkMuted : color, letterSpacing: "-0.8px", lineHeight: 1 }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function HistoryRow({ run, isLast, onClick, onDelete }: { run: RunSummary; isLast: boolean; onClick: () => void; onDelete: () => void }) {
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
        gridTemplateColumns: "130px 1fr 110px 100px 130px 90px 40px",
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

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {run.status !== "running" && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="삭제"
            style={{ background: "none", border: "none", cursor: "pointer", color: A.hairline, padding: 4, borderRadius: 6 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = A.hairline; e.currentTarget.style.background = "transparent"; }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 6v4M8.5 6v4M3 3.5l.7 7.2a.5.5 0 00.5.3h5.6a.5.5 0 00.5-.3L11 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "56px 0 40px", textAlign: "center" }}>

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

      {/* 템플릿 빠른 시작 */}
      <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%", maxWidth: 480 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: A.inkMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          템플릿으로 빠르게 시작
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
          {TEMPLATES.map(({ label, icon, scenario }) => (
            <Link
              key={label}
              href={`/new?scenarios=${encodeURIComponent(scenario)}`}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", borderRadius: 10,
                background: A.canvas, border: `1px solid ${A.hairline}`,
                textDecoration: "none", cursor: "pointer",
                transition: "border-color .12s, background .12s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = A.blue; e.currentTarget.style.background = "rgba(0,102,204,0.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = A.hairline; e.currentTarget.style.background = A.canvas; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: A.ink }}>{label}</span>
              </div>
              <svg width="14" height="14" fill="none" stroke={A.blue} strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

const TEMPLATES = [
  {
    label: "로그인 플로우 테스트",
    icon: "🔐",
    scenario: `1. 로그인 페이지로 이동한다
2. 아이디 입력칸에 테스트 계정을 입력한다
3. 비밀번호 입력칸에 비밀번호를 입력한다
4. 로그인 버튼을 클릭한다
5. 로그인 후 메인 화면이 표시되는지 확인한다`,
  },
  {
    label: "회원가입 시나리오",
    icon: "✍️",
    scenario: `1. 회원가입 페이지로 이동한다
2. 이름, 이메일, 비밀번호를 입력한다
3. 이용약관 동의 체크박스를 클릭한다
4. 가입하기 버튼을 클릭한다
5. 가입 완료 메시지 또는 이메일 인증 안내가 표시되는지 확인한다`,
  },
  {
    label: "결제 프로세스 검증",
    icon: "💳",
    scenario: `1. 상품 목록 페이지로 이동한다
2. 상품을 하나 선택하여 장바구니에 추가한다
3. 장바구니 페이지로 이동한다
4. 결제하기 버튼을 클릭한다
5. 결제 정보 입력 화면이 표시되는지 확인한다`,
  },
];
