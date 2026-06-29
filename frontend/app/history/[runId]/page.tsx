"use client";

import useSWR from "swr";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

// ── Type definitions ────────────────────────────────────────────────────────
type RunStatus = "running" | "completed" | "failed";
type CaseStatus = "Pass" | "Fail" | "Pending";

interface UXSuggestion {
  area: string;
  issue: string;
  suggestion: string;
}

interface TestCase {
  testId: string;
  feature: string;
  scenario: string;
  status: CaseStatus;
  failReason: string;
  videoUrl: string;
  screenshotUrl: string;
  screenshotBase64?: string;
  consoleLogs?: string[];
  suggestions?: UXSuggestion[];
  verificationStatus?: "approved" | "rejected" | "pending";
  reviewReason?: string;
}

interface RunResult {
  runId: string;
  status: RunStatus;
  paused?: boolean;
  total: number;
  passed: number;
  failed: number;
  createdAt: string;
  cases: TestCase[];
  mode?: "excel" | "natural";
  targetUrl?: string;
  scenarios?: string;
  error?: string;
  loginStatus?: "running" | "success" | "fail";
  loginFailReason?: string;
  loginSteps?: string[];
}

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  indigo: "#0066cc",
  indigoDark: "#0055aa",
  indigoBg: "#eff6ff",
  indigoBg2: "#dbeafe",
  green: "#16a34a",
  greenBg: "#f0fdf4",
  red: "#dc2626",
  redBg: "#fef2f2",
  amber: "#d97706",
  amberBg: "#fffbeb",
  glass: "#ffffff",
  border: "#e0e0e0",
  borderSoft: "#f0f0f0",
  text: "#1d1d1f",
  textMid: "#6b7280",
  textLight: "#9ca3af",
  textFaint: "#d1d5db",
  bgGray: "#f5f5f7",
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ── Main Page Component ────────────────────────────────────────────────────
export default function HistoryDetailPage({ params }: { params: { runId: string } }) {
  const router = useRouter();
  const runId = params.runId;
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "pass" | "fail" | "review">("all");

  const { data, error, isLoading } = useSWR<RunResult>(
    `/api/status?run_id=${runId}`,
    fetcher,
    {
      refreshInterval: 0, // No auto-refresh for history detail
      revalidateOnFocus: false,
    }
  );

  useEffect(() => {
    if (data?.cases && !selectedTestId) {
      setSelectedTestId(data.cases[0]?.testId || null);
    }
  }, [data?.cases, selectedTestId]);

  if (isLoading) return <LoadingScreen />;
  if (error || !data) return <ErrorScreen msg={error?.message || "데이터를 불러올 수 없습니다."} />;

  const activeCase = data.cases.find((c) => c.testId === selectedTestId) ?? null;
  const displayCases = data.cases;

  const passCount = displayCases.filter(
    (c) => c.status === "Pass" && c.verificationStatus !== "rejected"
  ).length;
  const failCount = displayCases.filter((c) => c.status === "Fail").length;
  const reviewCount = displayCases.filter((c) => c.verificationStatus === "pending").length;

  const filteredCases = displayCases.filter((c) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "pass") return c.status === "Pass" && c.verificationStatus !== "rejected";
    if (filterStatus === "fail") return c.status === "Fail";
    if (filterStatus === "review") return c.verificationStatus === "pending";
    return true;
  });

  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Geist', sans-serif",
        background: C.bgGray,
      }}
    >
      {/* ── LEFT COLUMN (40%) ──────────────────────────────────────────────── */}
      <div
        style={{
          width: "40%",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          padding: "24px",
          overflowY: "auto",
          borderRight: `1px solid ${C.border}`,
        }}
      >
        {/* Section 1: Execution Summary Card */}
        <ExecutionSummaryCard
          total={data.total}
          passed={data.passed}
          failed={data.failed}
          status={data.status === "failed" ? "Fail" : "Pass"}
          createdAt={data.createdAt}
        />

        {/* Section 2: Login Failure Warning (conditional) */}
        {data.loginStatus === "fail" && (
          <LoginFailureWarning
            loginFailReason={data.loginFailReason}
            loginSteps={data.loginSteps}
          />
        )}

        {/* Section 3: Scenario List */}
        <ScenarioListSection
          cases={filteredCases}
          allCases={displayCases}
          passCount={passCount}
          failCount={failCount}
          reviewCount={reviewCount}
          filterStatus={filterStatus}
          onFilterChange={setFilterStatus}
          selectedTestId={selectedTestId}
          onSelect={setSelectedTestId}
          targetUrl={data.targetUrl}
          scenarios={data.scenarios}
          mode={data.mode}
          runId={runId}
        />

        {/* Retry button */}
        {data.mode === "natural" && data.targetUrl && data.scenarios && (
          <RetryButton targetUrl={data.targetUrl} scenarios={data.scenarios} />
        )}
      </div>

      {/* ── RIGHT COLUMN (60%) ──────────────────────────────────────────────── */}
      <div
        style={{
          width: "60%",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          padding: "24px",
          overflowY: "auto",
        }}
      >
        {/* Section 1: Media Viewer */}
        <MediaViewerCard activeCase={activeCase} />

        {/* Section 2: Execution Timeline */}
        <ExecutionTimelineCard
          consoleLogs={activeCase?.consoleLogs ?? []}
          failReason={activeCase?.failReason}
          status={activeCase?.status ?? "Pending"}
        />
      </div>
    </div>
  );
}

// ── SUBCOMPONENTS ──────────────────────────────────────────────────────────

// Execution Summary Card
function ExecutionSummaryCard({
  total,
  passed,
  failed,
  status,
  createdAt,
}: {
  total: number;
  passed: number;
  failed: number;
  status: "Pass" | "Fail";
  createdAt: string;
}) {
  const progress = total > 0 ? Math.round((passed / total) * 100) : 0;
  const statusBadge = status === "Fail" ? "실패" : "완료";
  const statusColor = status === "Fail" ? C.red : C.green;
  const statusBg = status === "Fail" ? C.redBg : C.greenBg;

  return (
    <div
      style={{
        background: C.glass,
        borderRadius: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${C.borderSoft}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>
            실행 결과
          </h3>
          <p style={{ fontSize: 11, color: C.textLight, margin: "4px 0 0", marginTop: 4 }}>
            {new Date(createdAt).toLocaleString("ko-KR")} · {total} 케이스
          </p>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "4px 12px",
            borderRadius: 999,
            background: statusBg,
            color: statusColor,
            border: `1px solid ${statusColor}33`,
          }}
        >
          {statusBadge}
        </span>
      </div>

      {/* Progress Bar */}
      <div style={{ padding: "12px 20px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: C.textLight }}>
            {passed} / {total} 완료
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.indigo }}>
            {progress}%
          </span>
        </div>
        <div
          style={{
            height: 6,
            background: C.indigoBg,
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: C.indigo,
              borderRadius: 999,
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>

      {/* Summary Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          padding: "12px 20px 16px",
          borderTop: `1px solid ${C.borderSoft}`,
        }}
      >
        <StatBox label="전체" value={total} color={C.text} />
        <StatBox label="성공" value={passed} color={C.green} />
        <StatBox label="실패" value={failed} color={C.red} />
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: C.bgGray,
        borderRadius: 9,
        textAlign: "center",
      }}
    >
      <span style={{ fontSize: 10, color: C.textLight, display: "block" }}>
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, color, display: "block" }}>
        {value}
      </span>
    </div>
  );
}

// Login Failure Warning
function LoginFailureWarning({
  loginFailReason,
  loginSteps,
}: {
  loginFailReason?: string;
  loginSteps?: string[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        border: `1px solid ${C.red}`,
        borderRadius: 12,
        background: C.redBg,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 16 }}>🔑</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.red, flex: 1, textAlign: "left" }}>
          로그인 실패
        </span>
        <svg
          width="12"
          height="12"
          fill="none"
          stroke={C.red}
          strokeWidth="2"
          viewBox="0 0 12 12"
          style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <path
            d="M2 4l4 4 4-4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {expanded && (
        <div
          style={{
            padding: "12px 16px",
            borderTop: `1px solid ${C.red}33`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {loginFailReason && (
            <div>
              <p
                style={{
                  fontSize: 11,
                  color: C.textLight,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  margin: "0 0 6px",
                }}
              >
                실패 사유
              </p>
              <p style={{ fontSize: 12, color: C.text, margin: 0, lineHeight: 1.5 }}>
                {loginFailReason}
              </p>
            </div>
          )}
          {loginSteps && loginSteps.length > 0 && (
            <div>
              <p
                style={{
                  fontSize: 11,
                  color: C.textLight,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  margin: "0 0 6px",
                }}
              >
                실행 단계
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {loginSteps.map((step, i) => (
                  <div key={i} style={{ display: "flex", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.indigo,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}.
                    </span>
                    <span style={{ fontSize: 11, color: C.textMid }}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Scenario List Section
function ScenarioListSection({
  cases,
  allCases,
  passCount,
  failCount,
  reviewCount,
  filterStatus,
  onFilterChange,
  selectedTestId,
  onSelect,
  targetUrl,
  scenarios,
  mode,
  runId,
}: {
  cases: TestCase[];
  allCases: TestCase[];
  passCount: number;
  failCount: number;
  reviewCount: number;
  filterStatus: "all" | "pass" | "fail" | "review";
  onFilterChange: (status: "all" | "pass" | "fail" | "review") => void;
  selectedTestId: string | null;
  onSelect: (testId: string) => void;
  targetUrl?: string;
  scenarios?: string;
  mode?: string;
  runId: string;
}) {
  return (
    <div
      style={{
        background: C.glass,
        borderRadius: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "8px 12px",
          borderBottom: `1px solid ${C.borderSoft}`,
        }}
      >
        {[
          { key: "all" as const, label: "전체", count: allCases.length },
          { key: "pass" as const, label: "✅ 완료", count: passCount },
          { key: "fail" as const, label: "❌ 실패", count: failCount },
          {
            key: "review" as const,
            label: "⚠️ 확인 필요",
            count: reviewCount,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => onFilterChange(tab.key)}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 8,
              border: "none",
              background:
                filterStatus === tab.key ? C.indigo : "transparent",
              color:
                filterStatus === tab.key ? "#fff" : C.textMid,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {tab.label} <span style={{ opacity: 0.7 }}>({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Scenario list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {cases.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 120,
              color: C.textLight,
              fontSize: 13,
            }}
          >
            필터링된 케이스가 없습니다
          </div>
        ) : (
          cases.map((tc) => (
            <ScenarioCard
              key={tc.testId}
              tc={tc}
              isActive={tc.testId === selectedTestId}
              onClick={() => onSelect(tc.testId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ScenarioCard({
  tc,
  isActive,
  onClick,
}: {
  tc: TestCase;
  isActive: boolean;
  onClick: () => void;
}) {
  const isFail = tc.status === "Fail";
  const isPass = tc.status === "Pass";

  return (
    <div
      onClick={onClick}
      style={{
        padding: "12px 14px",
        borderRadius: 11,
        cursor: "pointer",
        transition: "all 0.15s",
        background: isActive ? C.glass : "transparent",
        border: isActive
          ? `1.5px solid ${C.indigo}`
          : `1px solid ${C.borderSoft}`,
        boxShadow: isActive
          ? "0 2px 8px rgba(0,102,204,0.12)"
          : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          {isPass ? (
            <CheckCircle color={C.green} />
          ) : isFail ? (
            <XCircle color={C.red} />
          ) : (
            <span style={{ fontSize: 14 }}>⏳</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 12.5,
              color: C.text,
              lineHeight: 1.45,
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {tc.scenario}
          </p>
          {tc.scenario.length > 80 && (
            <span
              style={{
                fontSize: 10,
                color: C.indigo,
                fontWeight: 600,
                display: "block",
                marginTop: 4,
              }}
            >
              전체 보기 ∨
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Retry Button
function RetryButton({
  targetUrl,
  scenarios,
}: {
  targetUrl: string;
  scenarios: string;
}) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        const params = new URLSearchParams({
          url: targetUrl,
          scenarios: scenarios,
        });
        router.push(`/new?${params.toString()}`);
      }}
      style={{
        width: "100%",
        padding: "12px 16px",
        borderRadius: 12,
        border: "none",
        background: C.indigo,
        color: "#fff",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = C.indigoDark;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = C.indigo;
      }}
    >
      시나리오 수정 후 재시도
    </button>
  );
}

// Media Viewer Card
function MediaViewerCard({ activeCase }: { activeCase: TestCase | null }) {
  return (
    <div
      style={{
        background: C.glass,
        borderRadius: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 300,
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f9fafb",
          position: "relative",
        }}
      >
        {activeCase?.videoUrl ? (
          <video
            src={activeCase.videoUrl}
            controls
            autoPlay
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              background: "#000",
            }}
          />
        ) : activeCase?.screenshotBase64 ? (
          <img
            src={`data:image/png;base64,${activeCase.screenshotBase64}`}
            alt="screenshot"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        ) : activeCase?.screenshotUrl ? (
          <img
            src={activeCase.screenshotUrl}
            alt="screenshot"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        ) : (
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: 48 }}>📸</span>
            <p style={{ fontSize: 13, color: C.textLight, marginTop: 8 }}>
              스크린샷 없음
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Execution Timeline Card
function ExecutionTimelineCard({
  consoleLogs,
  failReason,
  status,
}: {
  consoleLogs: string[];
  failReason?: string;
  status: CaseStatus;
}) {
  const parseStep = (log: string) => {
    const m = log.match(/^\[Step (\d+)\]\s+(.+?)(?:\s+—\s+(.+))?$/);
    if (m) return { num: m[1], action: m[2], details: m[3] || "" };
    return { num: "?", action: log, details: "" };
  };

  return (
    <div
      style={{
        background: C.glass,
        borderRadius: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${C.borderSoft}`,
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>
          실행 타임라인
        </h3>
      </div>

      {/* Timeline content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {/* Failure reason (if present) */}
        {failReason && status === "Fail" && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: `1px solid ${C.red}`,
              background: C.redBg,
              marginBottom: 16,
            }}
          >
            <p
              style={{
                fontSize: 12,
                color: C.red,
                margin: 0,
                fontWeight: 600,
              }}
            >
              실패 사유: {failReason}
            </p>
          </div>
        )}

        {/* Timeline */}
        {consoleLogs.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "24px",
              color: C.textLight,
              fontSize: 13,
            }}
          >
            로그 없음
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              position: "relative",
            }}
          >
            {/* Vertical line */}
            <div
              style={{
                position: "absolute",
                left: 15,
                top: 0,
                bottom: 0,
                width: 2,
                background: C.borderSoft,
              }}
            />

            {consoleLogs.map((log, i) => {
              const step = parseStep(log);
              return (
                <div key={i} style={{ display: "flex", gap: 12 }}>
                  {/* Dot */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      minWidth: 32,
                      borderRadius: "50%",
                      background: C.glass,
                      border: `2px solid ${C.indigo}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 600,
                      color: C.indigo,
                      marginTop: 0,
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    {i + 1}
                  </div>

                  {/* Step content */}
                  <div
                    style={{
                      flex: 1,
                      padding: "12px 14px",
                      background: C.bgGray,
                      borderRadius: 10,
                      marginTop: 2,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.text,
                        margin: "0 0 4px",
                      }}
                    >
                      Step {step.num}: {step.action}
                    </p>
                    {step.details && (
                      <p
                        style={{
                          fontSize: 11,
                          color: C.textMid,
                          margin: 0,
                          lineHeight: 1.4,
                        }}
                      >
                        {step.details}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── UTILITY COMPONENTS ──────────────────────────────────────────────────────

function CheckCircle({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle
        cx="8"
        cy="8"
        r="7.5"
        fill={color}
        fillOpacity=".12"
        stroke={color}
        strokeWidth="1"
      />
      <path
        d="M5 8l2 2 4-4"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XCircle({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle
        cx="8"
        cy="8"
        r="7.5"
        fill={color}
        fillOpacity=".08"
        stroke={color}
        strokeWidth="1"
      />
      <path
        d="M5.5 5.5l5 5M10.5 5.5l-5 5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LoadingScreen() {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, sans-serif",
        background: C.bgGray,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 11,
            background: C.indigo,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>Q</span>
        </div>
        <p style={{ fontSize: 13, color: C.textLight }}>불러오는 중…</p>
      </div>
    </div>
  );
}

function ErrorScreen({ msg }: { msg: string }) {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        background: C.bgGray,
      }}
    >
      <div
        style={{
          maxWidth: 360,
          padding: "20px 24px",
          borderRadius: 14,
          border: `1px solid #fecaca`,
          background: C.redBg,
          fontSize: 13,
          color: C.red,
        }}
      >
        {msg}
      </div>
    </div>
  );
}
