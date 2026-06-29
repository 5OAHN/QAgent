"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import DashboardAnalytics from "@/components/DashboardAnalytics";
import UsageWidget, { UsageData } from "@/components/UsageWidget";
import FilterDropdown, { FilterOption } from "@/components/FilterDropdown";

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

// Filter option definitions
const PERIOD_OPTIONS: FilterOption[] = [
  { key: "today", label: "오늘" },
  { key: "7d", label: "7일" },
  { key: "30d", label: "30일" },
];

type Period = "today" | "7d" | "30d" | "all";

function filterByPeriod(runs: RunSummary[], selectedPeriods: string[]): RunSummary[] {
  if (selectedPeriods.length === 0) return runs;
  const now = Date.now();
  const ranges: Record<string, number> = {
    today: 1000 * 60 * 60 * 24,
    "7d": 1000 * 60 * 60 * 24 * 7,
    "30d": 1000 * 60 * 60 * 24 * 30,
  };

  return runs.filter((r) => {
    const createdTime = new Date(r.createdAt).getTime();
    for (const period of selectedPeriods) {
      const cutoff = now - (ranges[period] || 0);
      if (createdTime >= cutoff) return true;
    }
    return false;
  });
}

export default function HomePage() {
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);

  const { data: runs = [], isLoading } = useSWR<RunSummary[]>(
    "/api/history",
    fetcher,
    { refreshInterval: 5000 }
  );

  // Apply period filter only
  const filteredRuns = filterByPeriod(runs, selectedPeriods);

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
            {/* 기간 필터 */}
            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
              <FilterDropdown
                label="기간"
                icon={
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M3 10h18M9 1v6M15 1v6" strokeLinecap="round" />
                  </svg>
                }
                options={PERIOD_OPTIONS}
                selectedValues={selectedPeriods}
                onSelectionChange={setSelectedPeriods}
              />
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

            {/* 사용량 위젯 */}
            <UsageWidget data={generateUsageData(filteredRuns)} />
          </>
        )}
      </main>
    </div>
  );
}

function generateUsageData(runs: RunSummary[]): UsageData {
  // 더미 데이터 생성 (실제로는 백엔드 API에서 받아옴)
  const totalTokensThisMonth = Math.floor(Math.random() * 100000) + 50000;
  const totalTokensLastMonth = Math.floor(Math.random() * 80000) + 40000;
  const totalScenariosRun = runs.length;
  const averageTokensPerScenario = totalScenariosRun > 0 ? totalTokensThisMonth / totalScenariosRun : 0;

  // 더미 비효율 시나리오 TOP 3
  const topInefficiencies = [
    { testId: "V-001", tokenUsage: 8500, lastExecutedAt: new Date(Date.now() - 3600000).toISOString() },
    { testId: "V-003", tokenUsage: 7200, lastExecutedAt: new Date(Date.now() - 86400000).toISOString() },
    { testId: "V-005", tokenUsage: 6800, lastExecutedAt: new Date(Date.now() - 259200000).toISOString() },
  ];

  return {
    totalTokensThisMonth,
    totalTokensLastMonth,
    averageTokensPerScenario,
    totalScenariosRun,
    topInefficiencies,
  };
}

function StatsRow({ runs }: { runs: RunSummary[] }) {
  const isEmpty = runs.length === 0;
  const stats = [
    { label: "전체 실행", value: runs.length, color: A.blue, bg: "rgba(0,102,204,0.07)" },
    { label: "완료", value: runs.filter((r) => r.status === "completed").length, color: "#16a34a", bg: "rgba(22,163,74,0.07)" },
    { label: "Fail 포함", value: runs.filter((r) => r.failed > 0).length, color: "#dc2626", bg: "rgba(220,38,38,0.07)" },
    { label: "진행 중", value: runs.filter((r) => r.status === "running").length, color: "#0066cc", bg: "rgba(0,102,204,0.07)" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
      {stats.map(({ label, value, color }) => (
        <div
          key={label}
          style={{
            ...card, padding: "18px 20px", opacity: isEmpty ? 0.55 : 1,
            transition: "opacity .2s, transform .15s, box-shadow .15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.06)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, color: A.inkMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
            {label}
          </p>
          <p style={{ fontSize: 28, fontWeight: 600, color: isEmpty ? A.inkMuted : color, letterSpacing: "-0.8px", lineHeight: 1 }}>
            {value}
          </p>
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

