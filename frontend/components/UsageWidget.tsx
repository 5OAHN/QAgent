"use client";

import { useRouter } from "next/navigation";
import { IconLightbulb, IconAlertTriangle } from "@/components/icons";

interface InefficiencyScenario {
  testId: string;
  tokenUsage: number;
  lastExecutedAt: string;
  runId?: string;
}

export interface UsageData {
  totalTokensThisMonth: number;
  totalTokensLastMonth: number;
  averageTokensPerScenario: number;
  totalScenariosRun: number;
  topInefficiencies: InefficiencyScenario[];
}

interface UsageWidgetProps {
  data?: UsageData;
  isLoading?: boolean;
}

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

export default function UsageWidget({ data, isLoading }: UsageWidgetProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginTop: 28 }}>
        <div style={{ ...card, padding: "20px", opacity: 0.5 }}>
          <div style={{ height: 40, background: A.parchment, borderRadius: 8, marginBottom: 10 }} />
          <div style={{ height: 20, background: A.parchment, borderRadius: 6 }} />
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const changePercent = data.totalTokensLastMonth > 0
    ? Math.round(((data.totalTokensThisMonth - data.totalTokensLastMonth) / data.totalTokensLastMonth) * 100)
    : 0;

  const isIncreased = changePercent > 0;

  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: A.ink, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
        <IconLightbulb size={14} />
        사용량 및 효율성
      </h2>

      {/* 사용량 통계 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 14 }}>
        {/* 누적 토큰 사용량 - 검정색 배경 */}
        <div
          style={{
            padding: "18px 20px",
            borderRadius: 14,
            background: "#1d1d1f",
            transition: "opacity .2s, transform .15s, box-shadow .15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 14px rgba(0,0,0,0.2)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, color: "#a3a3a7", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
            누적 토큰 사용량
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <p style={{ fontSize: 28, fontWeight: 600, color: "#ffffff", letterSpacing: "-0.8px", lineHeight: 1 }}>
              {data.totalTokensThisMonth.toLocaleString()}
            </p>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 6,
                background: isIncreased ? "rgba(220, 38, 38, 0.2)" : "rgba(22, 163, 74, 0.2)",
                color: isIncreased ? "#ff6b6b" : "#51cf66",
              }}
            >
              {isIncreased ? "↑" : "↓"} {Math.abs(changePercent)}% vs 전월
            </span>
          </div>
        </div>

        {/* 시나리오당 평균 사용량 */}
        <div
          style={{
            ...card,
            padding: "18px 20px",
            transition: "opacity .2s, transform .15s, box-shadow .15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 14px rgba(0,0,0,0.06)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, color: A.inkMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
            시나리오당 평균 사용량
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <p style={{ fontSize: 28, fontWeight: 600, color: A.blue, letterSpacing: "-0.8px", lineHeight: 1 }}>
              {Math.round(data.averageTokensPerScenario).toLocaleString()}
            </p>
            <span style={{ fontSize: 11, color: A.inkMuted }}>tokens</span>
          </div>
          <p style={{ fontSize: 12, color: A.inkMuted, marginTop: 8 }}>
            {data.totalScenariosRun}개 시나리오 실행
          </p>
        </div>
      </div>

      {/* 비효율 시나리오 TOP 3 */}
      {data.topInefficiencies.length > 0 && (
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${A.divider}`,
            background: A.parchment,
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: A.ink, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6 }}>
              <IconAlertTriangle size={13} color="#d97706" />
              비효율 시나리오 TOP 3
            </h3>
            <p style={{ fontSize: 11, color: A.inkMuted, marginTop: 4 }}>
              토큰을 가장 많이 소모하는 시나리오를 확인하고 최적화해보세요.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {data.topInefficiencies.map((scenario, index) => (
              <div
                key={scenario.testId}
                onClick={() => scenario.runId && router.push(`/dashboard/${scenario.runId}`)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 1fr 140px 120px",
                  padding: "14px 20px",
                  alignItems: "center",
                  borderBottom: index < data.topInefficiencies.length - 1 ? `1px solid ${A.divider}` : "none",
                  transition: "background .12s",
                  cursor: scenario.runId ? "pointer" : "default",
                }}
                onMouseEnter={(e) => scenario.runId && (e.currentTarget.style.background = A.parchment)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* 순위 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: index === 0 ? "#fbbf24" : index === 1 ? "#d1d5db" : "#f3f4f6",
                      color: index === 0 ? "#78350f" : index === 1 ? "#4b5563" : "#6b7280",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {index + 1}
                  </span>
                </div>

                {/* 테스트 ID */}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: A.ink, fontFamily: "monospace" }}>
                    {scenario.testId}
                  </p>
                </div>

                {/* 토큰 사용량 */}
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#dc2626" }}>
                    {scenario.tokenUsage.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 11, color: A.inkMuted, marginLeft: 4 }}>tokens</span>
                </div>

                {/* 최근 실행일 */}
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 12, color: A.inkMuted }}>
                    {formatDate(new Date(scenario.lastExecutedAt))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "어제";
  }
  return date.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}
