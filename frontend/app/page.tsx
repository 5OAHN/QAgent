"use client";

import { useState } from "react";
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

type Period = "today" | "7d" | "30d" | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "7d",    label: "7일" },
  { key: "30d",   label: "30일" },
  { key: "all",   label: "전체" },
];

function filterByPeriod(runs: RunSummary[], period: Period): RunSummary[] {
  if (period === "all") return runs;
  const now = Date.now();
  const ranges: Record<Exclude<Period, "all">, number> = {
    today: 1000 * 60 * 60 * 24,
    "7d":  1000 * 60 * 60 * 24 * 7,
    "30d": 1000 * 60 * 60 * 24 * 30,
  };
  const cutoff = now - ranges[period];
  return runs.filter((r) => new Date(r.createdAt).getTime() >= cutoff);
}

export default function HomePage() {
  const [period, setPeriod] = useState<Period>("all");

  const { data: runs = [], isLoading } = useSWR<RunSummary[]>(
    "/api/history",
    fetcher,
    { refreshInterval: 5000 }
  );

  const filteredRuns = filterByPeriod(runs, period);

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
            {/* 기간 선택 */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 4, background: A.canvas, borderRadius: 9, padding: 4, border: `1px solid ${A.hairline}` }}>
                {PERIODS.map(({ key, label }) => (
                  <button key={key} onClick={() => setPeriod(key)}
                    style={{
                      padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                      border: "none", cursor: "pointer", transition: "all .15s",
                      background: period === key ? A.blue : "transparent",
                      color: period === key ? "#fff" : A.inkMuted,
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 통계 카드 */}
            <StatsRow runs={filteredRuns} />

            {filteredRuns.length === 0 && (
              <div style={{ ...card, padding: "40px 0", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: A.inkMuted }}>선택한 기간에는 실행 이력이 없습니다.</p>
              </div>
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
