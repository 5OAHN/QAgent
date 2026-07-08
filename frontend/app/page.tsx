"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import DashboardAnalytics from "@/components/DashboardAnalytics";
import { IconSparkles } from "@/components/icons";

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

type Period = "all" | "today" | "7d" | "30d";

function filterByPeriod(runs: RunSummary[], period: Period): RunSummary[] {
  if (period === "all") return runs;
  const now = Date.now();
  const ranges: Record<Exclude<Period, "all">, number> = {
    today: 1000 * 60 * 60 * 24,
    "7d": 1000 * 60 * 60 * 24 * 7,
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

  // Apply period filter only
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
          <OnboardingChecklist />
        ) : (
          <>
            {/* 기간 필터 - 퀵버튼 */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 4, background: A.canvas, borderRadius: 9, padding: 4, border: `1px solid ${A.hairline}` }}>
                {(["all", "today", "7d", "30d"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      border: "none",
                      cursor: "pointer",
                      transition: "all .15s",
                      background: period === p ? A.blue : "transparent",
                      color: period === p ? "#fff" : A.inkMuted,
                    }}
                  >
                    {p === "all" ? "전체" : p === "today" ? "오늘" : p === "7d" ? "7일" : "30일"}
                  </button>
                ))}
              </div>
            </div>

            {/* 통계 카드 — 데이터 유무와 상관없이 항상 노출 */}
            <StatsRow runs={filteredRuns} />

            {filteredRuns.length === 0 && (
              <div style={{ ...card, padding: "40px 0", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: A.inkMuted }}>
                  {runs.length === 0 ? "아직 실행된 테스트 이력이 없습니다." : "선택한 기간에는 실행 이력이 없습니다."}
                </p>
              </div>
            )}

            {/* 분석 위젯 */}
            <DashboardAnalytics />
          </>
        )}
      </main>
    </div>
  );
}

/* ── 온보딩 체크리스트 — 첫 사용자를 3단계로 안내 ─────────────────── */
function OnboardingChecklist() {
  const { data: keyStatus } = useSWR<{ hasAnthropic: boolean }>("/api/settings/api-keys", fetcher);
  const { data: tests } = useSWR<any[]>("/api/tests", fetcher);
  const hasKey = !!keyStatus?.hasAnthropic;
  const hasTest = Array.isArray(tests) && tests.length > 0;

  const steps = [
    { done: hasKey, title: "Claude API 키 등록", desc: "AI 에이전트가 사용할 API 키를 연결하세요", href: "/settings", cta: "설정으로 이동" },
    { done: hasTest, title: "첫 테스트 만들기", desc: "자연어로 시나리오를 작성하면 AI가 알아서 실행합니다", href: "/new", cta: "테스트 만들기" },
    { done: false, title: "실행하고 결과 확인", desc: "실행 후에는 이 대시보드에서 추이를 볼 수 있습니다", href: "/tests", cta: "내 테스트 보기" },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <div style={{ maxWidth: 560, margin: "40px auto 0" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: "0 auto 14px",
          background: "rgba(0,102,204,0.08)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <IconSparkles size={26} color={A.blue} strokeWidth={1.6} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: A.ink, marginBottom: 6 }}>QAgent에 오신 것을 환영합니다</h2>
        <p style={{ fontSize: 13.5, color: A.inkMuted, lineHeight: 1.6 }}>
          자연어로 시나리오를 쓰면 AI 에이전트가 브라우저에서 직접 테스트합니다.<br />세 단계면 시작할 수 있습니다.
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            background: A.canvas, borderRadius: 12, padding: "16px 18px",
            border: `1.5px solid ${i === current ? A.blue : A.hairline}`,
            display: "flex", alignItems: "center", gap: 14,
            opacity: s.done || i === current ? 1 : 0.55,
          }}>
            <span style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: s.done ? "rgba(22,163,74,0.1)" : i === current ? "rgba(0,102,204,0.1)" : A.divider,
              color: s.done ? "#16a34a" : i === current ? A.blue : A.inkMuted,
              fontSize: 13, fontWeight: 700,
            }}>
              {s.done ? "✓" : i + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: A.ink }}>{s.title}</p>
              <p style={{ fontSize: 12, color: A.inkMuted }}>{s.desc}</p>
            </div>
            {!s.done && i === current && (
              <a href={s.href} style={{
                padding: "8px 14px", borderRadius: 8, background: A.blue, color: "#fff",
                fontSize: 12.5, fontWeight: 600, textDecoration: "none", flexShrink: 0,
              }}>
                {s.cta}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsRow({ runs }: { runs: RunSummary[] }) {
  const router = useRouter();
  const isEmpty = runs.length === 0;
  const stats = [
    { label: "전체 실행", value: runs.length, color: A.blue, bg: "rgba(0,102,204,0.07)", filterKey: null, isDark: true },
    { label: "완료", value: runs.filter((r) => r.status === "completed").length, color: "#16a34a", bg: "rgba(22,163,74,0.07)", filterKey: "completed", isDark: false },
    { label: "Fail 포함", value: runs.filter((r) => r.failed > 0).length, color: "#dc2626", bg: "rgba(220,38,38,0.07)", filterKey: "failIncluded", isDark: false },
    { label: "진행 중", value: runs.filter((r) => r.status === "running").length, color: "#0066cc", bg: "rgba(0,102,204,0.07)", filterKey: "running", isDark: false },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
      {stats.map(({ label, value, color, filterKey, isDark }) => (
        <button
          key={label}
          onClick={() => {
            if (filterKey) {
              router.push(`/history?status=${filterKey}`);
            } else {
              router.push("/history");
            }
          }}
          style={{
            padding: "18px 20px",
            opacity: isEmpty ? 0.55 : 1,
            transition: "opacity .2s, transform .15s, box-shadow .15s",
            cursor: "pointer",
            border: "none",
            borderRadius: 14,
            background: isDark ? "#1d1d1f" : A.canvas,
            font: "inherit",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = isDark ? "0 4px 14px rgba(0,0,0,0.2)" : "0 4px 14px rgba(0,0,0,0.06)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, color: isDark ? "#a3a3a7" : A.inkMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
            {label}
          </p>
          <p style={{ fontSize: 28, fontWeight: 600, color: isDark ? "#ffffff" : (isEmpty ? A.inkMuted : color), letterSpacing: "-0.8px", lineHeight: 1 }}>
            {value}
          </p>
        </button>
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

