"use client";

import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type RunStatus = "running" | "completed" | "failed";
type CaseStatus = "Pass" | "Fail" | "Pending";
type ControlAction = "cancel" | "pause" | "resume";

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
  verificationStatus?: "approved" | "rejected" | "pending";
  reviewReason?: string;
  durationMs?: number;
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

const TERMINAL: RunStatus[] = ["completed", "failed"];
const fetcher = (url: string) => fetch(url).then((r) => r.json());

// 백엔드/API의 원시 에러 메시지(JSON, 영문 코드 등)를 사람이 읽을 수 있는 한글 사유로 변환
function humanizeFailReason(raw?: string): string {
  if (!raw) return "알 수 없는 오류로 테스트가 실패했습니다.";

  if (/credit balance is too low/i.test(raw)) {
    return "AI 사용량(크레딧)이 부족하여 테스트를 진행할 수 없습니다. 관리자에게 문의해 주세요.";
  }
  if (/사용자에 의해 중지/.test(raw) || /사용자에 의해 중지되었습니다/.test(raw)) {
    return "사용자에 의해 테스트가 중지되었습니다.";
  }
  if (/timeout|timed out/i.test(raw)) {
    return "응답 시간이 초과되어 테스트가 실패했습니다.";
  }
  if (/invalid_request_error/i.test(raw)) {
    return "AI 요청 처리 중 오류가 발생하여 테스트가 실패했습니다.";
  }
  if (/^\s*\d{3}\s*\{/.test(raw) || /^\s*\{/.test(raw)) {
    // 400 {"type":"error", ...} 형태의 원시 JSON/에러코드는 노출하지 않음
    return "시스템 오류로 인해 테스트가 실패했습니다.";
  }
  return raw;
}

// durationMs(밀리초)를 00:00:00(시:분:초) 형태로 변환
function formatDuration(ms?: number): string | null {
  if (!ms || ms < 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildDisplayCases(data: RunResult): TestCase[] {
  if (data.total === 0) return data.cases;

  const scenarioTexts =
    data.mode === "natural" && data.scenarios ? data.scenarios.split("\n\n---\n\n") : [];

  const result: TestCase[] = [];
  for (let i = 0; i < data.total; i++) {
    const testId = data.mode === "natural" ? `V-${String(i + 1).padStart(3, "0")}` : undefined;
    const existing = testId ? data.cases.find((c) => c.testId === testId) : data.cases[i];

    if (existing) {
      result.push(existing);
    } else {
      result.push({
        testId: testId || `pending-${i}`,
        feature: data.mode === "natural" ? "Vision 에이전트" : "",
        scenario: scenarioTexts[i]?.trim().slice(0, 200) || `케이스 ${i + 1}`,
        status: "Pending",
        failReason: "",
        videoUrl: "",
        screenshotUrl: "",
        consoleLogs: [],
      });
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function RunResultDashboard({ runId }: { runId: string }) {
  const router = useRouter();
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "pass" | "fail" | "review">("all");
  const prevCasesRef = useRef<Map<string, CaseStatus>>(new Map());

  const { data, error, isLoading, mutate } = useSWR<RunResult>(
    `/api/status?run_id=${runId}`,
    fetcher,
    {
      refreshInterval: (d) => (d?.status && TERMINAL.includes(d.status) ? 0 : 2000),
      revalidateOnFocus: true,
      refreshWhenHidden: false,
    }
  );

  useEffect(() => {
    if (!data?.cases) return;
    const running = data.cases.find((c) => c.status === "Pending");
    if (running) {
      setSelectedTestId(running.testId);
    } else if (!selectedTestId) {
      const firstDisplay = buildDisplayCases(data)[0];
      if (firstDisplay) setSelectedTestId(firstDisplay.testId);
    }
    const next = new Map<string, CaseStatus>();
    data.cases.forEach((c) => next.set(c.testId, c.status));
    prevCasesRef.current = next;
  }, [data?.cases]);

  const sendControl = async (action: ControlAction) => {
    await fetch(`/api/run/${runId}/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
        불러오는 중…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-500 text-sm">
        데이터를 불러올 수 없습니다.
      </div>
    );
  }

  const displayCases = buildDisplayCases(data);
  const hasPendingCase = displayCases.some((c) => c.status === "Pending");
  const isTerminal = TERMINAL.includes(data.status) && !hasPendingCase;
  const selectedCase = displayCases.find((c) => c.testId === selectedTestId) ?? displayCases[0] ?? null;

  const passCount = displayCases.filter((c) => c.status === "Pass" && c.verificationStatus !== "rejected").length;
  const failCount = displayCases.filter((c) => c.status === "Fail").length;
  const reviewCount = displayCases.filter((c) => c.verificationStatus === "pending").length;

  const filteredCases = displayCases.filter((c) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "pass") return c.status === "Pass" && c.verificationStatus !== "rejected";
    if (filterStatus === "fail") return c.status === "Fail";
    if (filterStatus === "review") return c.verificationStatus === "pending";
    return true;
  });

  const statusBadge =
    data.status === "failed"
      ? { label: "실패", className: "border-red-500 text-red-600 bg-white" }
      : data.status === "completed"
      ? { label: "완료", className: "border-green-500 text-green-600 bg-white" }
      : { label: "진행 중", className: "border-indigo-400 text-indigo-600 bg-white" };

  const progress = data.total > 0 ? Math.round(((data.passed + data.failed) / data.total) * 100) : 0;

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col px-6 py-5 min-h-0">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <button
            onClick={() => router.push("/history")}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            테스트 이력
          </button>

          {!isTerminal && (
            <div className="flex items-center gap-2">
              {data.paused ? (
                <button
                  onClick={() => sendControl("resume")}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all duration-200 active:scale-95"
                >
                  ▶ 재개
                </button>
              ) : (
                <button
                  onClick={() => sendControl("pause")}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-all duration-200 active:scale-95"
                >
                  ⏸ 일시정지
                </button>
              )}
              <button
                onClick={() => sendControl("cancel")}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-all duration-200 active:scale-95"
              >
                ■ 중지
              </button>
            </div>
          )}
        </div>

        {/* 2-column fill layout: 40% left / 60% right */}
        <div className="flex-1 flex gap-6 min-h-0">
          {/* ───────────── LEFT COLUMN (40%) ───────────── */}
          <div className="flex flex-col gap-4 min-h-0" style={{ width: "40%" }}>
            <ExecutionSummaryCard
              createdAt={data.createdAt}
              statusBadge={statusBadge}
              progress={progress}
              total={data.total}
              passed={passCount}
              failed={failCount}
            />

            {data.targetUrl && <TargetUrlCard url={data.targetUrl} />}

            {data.loginStatus === "fail" && (
              <LoginFailureAccordion reason={data.loginFailReason} steps={data.loginSteps} />
            )}

            <ScenarioListCard
              cases={displayCases}
              filteredCases={filteredCases}
              filterStatus={filterStatus}
              onFilterChange={setFilterStatus}
              selectedTestId={selectedCase?.testId ?? null}
              onSelect={setSelectedTestId}
              passCount={passCount}
              failCount={failCount}
              reviewCount={reviewCount}
              isPaused={!!data.paused}
              runId={runId}
              onVerify={() => mutate()}
              canRetry={data.mode === "natural" && !!data.targetUrl && !!data.scenarios && (isTerminal || !!data.paused)}
              onRetry={() => {
                const params = new URLSearchParams({ url: data.targetUrl!, scenarios: data.scenarios! });
                router.push(`/new?${params.toString()}`);
              }}
            />
          </div>

          {/* ───────────── RIGHT COLUMN (60%) ───────────── */}
          <div className="flex flex-col gap-4 min-h-0" style={{ width: "60%" }}>
            <MediaViewerCard tc={selectedCase} isTerminal={isTerminal} />
            <TimelineCard tc={selectedCase} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEFT: Execution Summary Card
// ─────────────────────────────────────────────────────────────────────────────

function ExecutionSummaryCard({
  createdAt,
  statusBadge,
  progress,
  total,
  passed,
  failed,
}: {
  createdAt: string;
  statusBadge: { label: string; className: string };
  progress: number;
  total: number;
  passed: number;
  failed: number;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold text-gray-900">실행 결과</h1>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${statusBadge.className}`}>
          {statusBadge.label}
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        {new Date(createdAt).toLocaleString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>

      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>{passed + failed} / {total} 케이스</span>
          <span className="font-semibold text-gray-700">{progress}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatBox label="전체" value={total} valueClassName="text-gray-900" />
        <StatBox label="성공" value={passed} valueClassName="text-blue-600" />
        <StatBox label="실패" value={failed} valueClassName="text-red-500" />
      </div>
    </div>
  );
}

function StatBox({ label, value, valueClassName }: { label: string; value: number; valueClassName: string }) {
  return (
    <div className="border border-gray-200 rounded-lg py-3 text-center">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEFT: Target URL Card
// ─────────────────────────────────────────────────────────────────────────────

function TargetUrlCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3 flex items-center gap-2.5 flex-shrink-0">
      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-gray-400 flex-shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 115.656 5.656l-1.5 1.5" />
      </svg>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gray-600 truncate flex-1 hover:text-indigo-600 transition-colors duration-200"
        title={url}
      >
        {url}
      </a>
      <button
        onClick={handleCopy}
        className="text-[11px] font-medium text-gray-400 hover:text-gray-600 flex-shrink-0 transition-all duration-200 active:scale-90"
      >
        {copied ? "복사됨" : "복사"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEFT: Login Failure Accordion
// ─────────────────────────────────────────────────────────────────────────────

function LoginFailureAccordion({ reason, steps }: { reason?: string; steps?: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-red-300 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors duration-200 hover:bg-red-50/50"
      >
        <div className="flex items-center gap-2 text-red-600">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
            />
          </svg>
          <span className="font-semibold text-sm">로그인 실패</span>
          {reason && <span className="text-xs text-red-400">— {reason}</span>}
        </div>
        <svg
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          className={`text-red-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && steps && steps.length > 0 && (
        <div className="px-5 pb-4 pt-1 border-t border-red-100 bg-red-50/50 max-h-48 overflow-y-auto">
          {steps.map((s, i) => (
            <p key={i} className="text-xs text-gray-600 whitespace-pre-line py-1">
              {s}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEFT: Scenario List Card
// ─────────────────────────────────────────────────────────────────────────────

function ScenarioListCard({
  cases,
  filteredCases,
  filterStatus,
  onFilterChange,
  selectedTestId,
  onSelect,
  passCount,
  failCount,
  reviewCount,
  isPaused,
  runId,
  onVerify,
  canRetry,
  onRetry,
}: {
  cases: TestCase[];
  filteredCases: TestCase[];
  filterStatus: "all" | "pass" | "fail" | "review";
  onFilterChange: (v: "all" | "pass" | "fail" | "review") => void;
  selectedTestId: string | null;
  onSelect: (id: string) => void;
  passCount: number;
  failCount: number;
  reviewCount: number;
  isPaused: boolean;
  runId: string;
  onVerify: () => void;
  canRetry: boolean;
  onRetry: () => void;
}) {
  const tabs = [
    { key: "all" as const, label: "전체", count: cases.length },
    { key: "pass" as const, label: "성공", count: passCount },
    { key: "fail" as const, label: "실패", count: failCount },
    { key: "review" as const, label: "확인필요", count: reviewCount },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col flex-1 min-h-0">
      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onFilterChange(tab.key)}
            className={`flex-1 text-xs font-semibold py-2 rounded-md transition-all duration-200 active:scale-95 ${
              filterStatus === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-base font-bold text-gray-900">시나리오</h3>
        <span className="text-xs font-semibold text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">
          {filteredCases.length}
        </span>
      </div>

      <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto pr-1">
        {filteredCases.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">표시할 케이스가 없습니다</p>
        ) : (
          filteredCases.map((tc) => (
            <ScenarioCard
              key={tc.testId}
              tc={tc}
              isSelected={tc.testId === selectedTestId}
              onClick={() => onSelect(tc.testId)}
              isPaused={isPaused}
              runId={runId}
              onVerify={onVerify}
            />
          ))
        )}
      </div>

      {canRetry && (
        <button
          onClick={onRetry}
          className="mt-5 w-full py-3 rounded-lg bg-blue-50 text-blue-600 font-semibold text-sm hover:bg-blue-100 transition-all duration-200 active:scale-[0.98]"
        >
          시나리오 수정 후 재시도
        </button>
      )}
    </div>
  );
}

function ScenarioCard({
  tc,
  isSelected,
  onClick,
  isPaused,
  runId,
  onVerify,
}: {
  tc: TestCase;
  isSelected: boolean;
  onClick: () => void;
  isPaused: boolean;
  runId: string;
  onVerify: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const isReview = tc.verificationStatus === "pending";

  const handleVerify = async (e: React.MouseEvent, status: "approved" | "rejected") => {
    e.stopPropagation();
    setVerifying(true);
    try {
      const res = await fetch(`/api/run/${runId}/case/${tc.testId}/verify`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationStatus: status }),
      });
      if (res.ok) onVerify();
    } catch {
      /* noop */
    }
    setVerifying(false);
  };

  const icon =
    tc.status === "Pending" ? (
      <span className="w-4 h-4 rounded-full bg-indigo-500 animate-pulse inline-block" />
    ) : isReview ? (
      <span className="text-base">⚠️</span>
    ) : tc.status === "Pass" ? (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-green-500">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-red-500">
        <circle cx="12" cy="12" r="10" />
        <path d="M9 9l6 6m0-6l-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );

  const lines = tc.scenario.split("\n").filter(Boolean);
  const isLong = tc.scenario.length > 90 || lines.length > 2;

  const duration = formatDuration(tc.durationMs);

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border-2 p-3.5 cursor-pointer transition-all duration-200 ease-out active:scale-[0.98] ${
        isSelected ? "border-blue-500 bg-blue-50/40 shadow-sm" : "border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-shrink-0 mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-gray-900">{tc.testId}</span>
              {tc.status === "Pending" && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                  {isPaused ? "일시정지" : "실행 중"}
                </span>
              )}
              {isReview && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                  확인 필요
                </span>
              )}
            </div>
            {duration && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400 flex-shrink-0">
                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {duration}
              </span>
            )}
          </div>
          <p className={`text-sm text-gray-700 whitespace-pre-line ${!expanded ? "line-clamp-2" : ""}`}>
            {tc.scenario}
          </p>
          {isLong && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="mt-1 text-xs text-blue-500 font-medium flex items-center gap-0.5 transition-colors duration-200 hover:text-blue-700"
            >
              {expanded ? "접기" : "전체 보기"}
              <svg
                width="10"
                height="10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
                className={`transition-transform ${expanded ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          {isReview && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={(e) => handleVerify(e, "approved")}
                disabled={verifying}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-green-600 text-white disabled:opacity-50 transition-all duration-200 active:scale-95 hover:bg-green-700"
              >
                승인
              </button>
              <button
                onClick={(e) => handleVerify(e, "rejected")}
                disabled={verifying}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-red-600 text-white disabled:opacity-50 transition-all duration-200 active:scale-95 hover:bg-red-700"
              >
                거부
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT: Media Viewer Card
// ─────────────────────────────────────────────────────────────────────────────

function MediaViewerCard({ tc, isTerminal }: { tc: TestCase | null; isTerminal: boolean }) {
  const imgSrc = tc?.screenshotBase64
    ? `data:image/png;base64,${tc.screenshotBase64}`
    : tc?.screenshotUrl || null;

  return (
    <div className="bg-gray-100 rounded-xl border border-gray-200 p-6 flex-1 min-h-0 flex items-center justify-center overflow-hidden">
      {!tc ? (
        <p className="text-gray-400 text-sm">시나리오를 선택하세요</p>
      ) : imgSrc ? (
        <img
          key={imgSrc}
          src={imgSrc}
          alt="screenshot"
          className="max-w-full max-h-full object-contain rounded-lg shadow-sm animate-[fadeIn_0.25s_ease-out]"
        />
      ) : (
        <p className="text-gray-400 text-sm">
          {!isTerminal && tc.status === "Pending" ? "실행 대기 중…" : "미디어 없음"}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT: Timeline Card
// ─────────────────────────────────────────────────────────────────────────────

function TimelineCard({ tc }: { tc: TestCase | null }) {
  const logs = tc?.consoleLogs ?? [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex-1 min-h-0 flex flex-col">
      <h3 className="text-base font-bold text-gray-900 mb-4 flex-shrink-0">실행 타임라인</h3>

      {tc?.status === "Fail" && tc.failReason && (
        <div className="mb-5 px-4 py-3 rounded-lg border border-red-300 bg-red-50 flex-shrink-0">
          <p className="text-sm text-red-600">
            <span className="font-semibold">실패 사유 : </span>
            {humanizeFailReason(tc.failReason)}
          </p>
        </div>
      )}

      {logs.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">실행 로그가 없습니다</p>
      ) : (
        <div className="relative flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="absolute left-[5px] top-1 bottom-1 w-px bg-gray-200" />
          <div className="flex flex-col gap-3">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-3 relative">
                <span className="w-[11px] h-[11px] rounded-full bg-gray-300 border-2 border-white flex-shrink-0 mt-1 z-10" />
                <div className="flex-1 bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                  {log}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
