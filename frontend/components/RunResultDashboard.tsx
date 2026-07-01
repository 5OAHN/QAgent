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
  tokenUsage?: number;
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
  if (!raw) return "알 수 없는 오류";
  if (/GEMINI_QUOTA_EXCEEDED/i.test(raw) || /quota.*exceeded/i.test(raw)) {
    return "Gemini API 할당량 초과";
  }
  if (/All providers failed/i.test(raw)) {
    const lastErr = raw.match(/Last error:\s*(.+)/i)?.[1];
    if (lastErr) return `AI 오류: ${lastErr.length > 30 ? lastErr.slice(0, 30) + "…" : lastErr}`;
    return "AI 제공자 연결 실패";
  }
  if (/credit balance is too low/i.test(raw)) {
    return "AI 크레딧 부족";
  }
  if (/사용자에 의해 중지/.test(raw)) {
    return "사용자 중지";
  }
  if (/timeout|timed out/i.test(raw)) {
    return "응답 시간 초과";
  }
  if (/invalid_request_error/i.test(raw)) {
    return "AI 요청 오류";
  }
  if (/^\s*\d{3}\s*\{/.test(raw) || /^\s*\{/.test(raw)) {
    return "시스템 오류";
  }
  return raw.length > 40 ? raw.slice(0, 40) + "…" : raw;
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

// 실패한 케이스를 Jira/Slack/GitHub Issue에 바로 붙여넣을 수 있는 Markdown 리포트로 변환
function buildErrorReportMarkdown(
  tc: TestCase,
  meta: { runId: string; targetUrl?: string; createdAt: string }
): string {
  const dashboardUrl =
    typeof window !== "undefined" ? `${window.location.origin}/dashboard/${meta.runId}` : `/dashboard/${meta.runId}`;

  const formattedDate = new Date(meta.createdAt).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const recentLogs = (tc.consoleLogs ?? []).slice(-5).join("\n\n");

  return `🚨 **QAgent 에러 리포트**

| 항목 | 내용 |
|---|---|
| **테스트 ID** | ${tc.testId} |
| **시나리오** | ${tc.scenario.replace(/\n/g, " ")} |
| **상태** | ❌ Fail |
| **진입 URL** | ${meta.targetUrl ?? "-"} |
| **발생 일시** | ${formattedDate} (KST) |
| **환경 정보** | Chromium (Playwright) / 1280x720 |

🔗 **상세 리포트 및 스크린샷 보기:** [대시보드 열기](${dashboardUrl})

---

❗️ **요약된 실패 사유**
${humanizeFailReason(tc.failReason)}

❗️ **상세 에러 메시지**
\`\`\`
${tc.failReason || "상세 에러 메시지가 없습니다."}
\`\`\`

📋 **최근 실행 로그 (마지막 5단계)**
\`\`\`
${recentLogs || "실행 로그가 없습니다."}
\`\`\`
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO STEP EDITOR — 자연어 시나리오 텍스트 ↔ 단계 배열 변환
// ─────────────────────────────────────────────────────────────────────────────

type StepActionType = "click" | "input" | "wait" | "scroll" | "assert" | "custom";

interface ScenarioStep {
  id: string;
  actionType: StepActionType;
  target: string;
}

const ACTION_TYPE_OPTIONS: { value: StepActionType; label: string; suffix: string }[] = [
  { value: "click", label: "클릭", suffix: "클릭" },
  { value: "input", label: "텍스트 입력", suffix: "입력" },
  { value: "wait", label: "대기", suffix: "대기" },
  { value: "scroll", label: "스크롤", suffix: "스크롤" },
  { value: "assert", label: "확인", suffix: "확인" },
  { value: "custom", label: "기타(직접 작성)", suffix: "" },
];

let stepIdCounter = 0;
function nextStepId(): string {
  stepIdCounter += 1;
  return `step-${Date.now()}-${stepIdCounter}`;
}

function parseScenarioToSteps(scenario: string): ScenarioStep[] {
  const matches = Array.from(scenario.matchAll(/\d+\.\s*([^\n]+)/g)).map((m) => m[1].trim());
  const lines = matches.length > 0 ? matches : scenario.split("\n").map((l) => l.trim()).filter(Boolean);

  return lines.map((line) => {
    let actionType: StepActionType = "custom";
    let target = line;

    if (/클릭\s*$/.test(line)) {
      actionType = "click";
      target = line.replace(/\s*클릭\s*$/, "");
    } else if (/(텍스트\s*)?입력\s*$/.test(line)) {
      actionType = "input";
      target = line.replace(/\s*(텍스트\s*)?입력\s*$/, "");
    } else if (/대기\s*$/.test(line)) {
      actionType = "wait";
      target = line.replace(/\s*대기\s*$/, "");
    } else if (/스크롤\s*$/.test(line)) {
      actionType = "scroll";
      target = line.replace(/\s*스크롤\s*$/, "");
    } else if (/(확인|검증)\s*$/.test(line)) {
      actionType = "assert";
      target = line.replace(/\s*(확인|검증)\s*$/, "");
    }

    return { id: nextStepId(), actionType, target: target.trim() };
  });
}

function stepsToScenarioText(steps: ScenarioStep[]): string {
  return steps
    .map((step, i) => {
      const option = ACTION_TYPE_OPTIONS.find((o) => o.value === step.actionType);
      const text =
        step.actionType === "custom" || !option?.suffix
          ? step.target.trim()
          : `${step.target.trim()} ${option.suffix}`.trim();
      return `${i + 1}. ${text}`;
    })
    .join("\n");
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
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [editedScenarios, setEditedScenarios] = useState<Record<string, string>>({});
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
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

  const toggleChecked = (testId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) next.delete(testId);
      else next.add(testId);
      return next;
    });
  };

  const getEffectiveScenario = (tc: TestCase) => editedScenarios[tc.testId] ?? tc.scenario;

  const handleApplyEdit = (testId: string, newScenarioText: string) => {
    setEditedScenarios((prev) => ({ ...prev, [testId]: newScenarioText }));
    setEditingTestId(null);
  };

  const handleRetrySelected = async () => {
    if (!data?.targetUrl || checkedIds.size === 0 || retrying) return;
    const selectedScenarios = displayCases
      .filter((c) => checkedIds.has(c.testId))
      .map((c) => getEffectiveScenario(c).trim());
    setRetrying(true);
    try {
      const res = await fetch("/api/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: data.targetUrl,
          scenarios: selectedScenarios,
          loginConfig: (data as any).loginConfig ?? undefined,
        }),
      });
      const result = await res.json();
      if (result.run_id) {
        router.push(`/dashboard/${result.run_id}`);
      }
    } catch {
      /* noop */
    } finally {
      setRetrying(false);
      setCheckedIds(new Set());
    }
  };

  const handleSelectAll = (cases: TestCase[], canEdit: boolean) => {
    if (!canEdit) return;
    const selectableCases = cases.filter((c) => true); // 모든 케이스 선택 가능
    const allSelected = selectableCases.every((c) => checkedIds.has(c.testId));
    if (allSelected) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(selectableCases.map((c) => c.testId)));
    }
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

            {(data as any).loginConfig?.fields?.length > 0 && (
              <LoginInfoCard fields={(data as any).loginConfig.fields} status={data.loginStatus} />
            )}

            {data.loginStatus && (
              <LoginStatusCard
                status={data.loginStatus}
                reason={data.loginFailReason}
                steps={data.loginSteps}
              />
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
              canEdit={data.mode === "natural" && !!data.targetUrl && (isTerminal || !!data.paused)}
              checkedIds={checkedIds}
              onToggleChecked={toggleChecked}
              onSelectAll={() => handleSelectAll(displayCases, data.mode === "natural" && !!data.targetUrl && (isTerminal || !!data.paused))}
              onEditRequest={setEditingTestId}
              getEffectiveScenario={getEffectiveScenario}
            />
          </div>

          {/* ───────────── RIGHT COLUMN (60%) ───────────── */}
          <div className="flex flex-col gap-4 min-h-0" style={{ width: "60%" }}>
            <MediaViewerCard tc={selectedCase} isTerminal={isTerminal} />
            <TimelineCard tc={selectedCase} runId={runId} targetUrl={data.targetUrl} createdAt={data.createdAt} />
          </div>
        </div>
      </div>

      {/* ── Floating Action Bar: 체크된 시나리오 일괄 재시도 ───────────────────── */}
      <FloatingActionBar
        count={checkedIds.size}
        onRetry={handleRetrySelected}
        onCancel={() => setCheckedIds(new Set())}
        retrying={retrying}
      />

      {/* ── Scenario Edit Modal ─────────────────────────────────────────────── */}
      {editingTestId && (
        <ScenarioEditModal
          testId={editingTestId}
          scenarioText={getEffectiveScenario(displayCases.find((c) => c.testId === editingTestId)!)}
          onClose={() => setEditingTestId(null)}
          onApply={(newText) => handleApplyEdit(editingTestId, newText)}
        />
      )}
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
        className="text-xs font-medium text-gray-400 hover:text-gray-600 flex-shrink-0 transition-all duration-200 active:scale-90"
      >
        {copied ? "복사됨" : "복사"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEFT: Login Failure Accordion
// ─────────────────────────────────────────────────────────────────────────────

function LoginInfoCard({ fields, status }: { fields: { label: string; value: string; isPassword: boolean }[]; status?: string }) {
  const [open, setOpen] = useState(false);
  const statusColor = status === "success" ? "text-green-600" : status === "fail" ? "text-red-500" : "text-gray-400";
  const statusLabel = status === "success" ? "로그인 성공" : status === "fail" ? "로그인 실패" : status === "running" ? "로그인 진행 중" : "";

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 gap-2.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <svg width="14" height="14" fill="none" stroke="#6b7280" strokeWidth="1.8" viewBox="0 0 24 24" className="flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-xs font-semibold text-gray-700">로그인 계정 정보</span>
          <span className="text-xs text-gray-400">— {fields.map(f => f.isPassword ? "••••••" : f.value).join(" / ")}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {statusLabel && <span className={`text-[11px] font-medium ${statusColor}`}>{statusLabel}</span>}
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-3 pt-1 border-t border-gray-100 bg-gray-50/50">
          <div className="flex flex-col gap-1.5 mt-1">
            {fields.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400 w-20 flex-shrink-0">{f.label || `필드 ${i + 1}`}</span>
                <span className="text-[12px] font-medium text-gray-700">
                  {f.isPassword ? "••••••••" : f.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LoginStatusCard({ status, reason, steps }: { status: "running" | "success" | "fail"; reason?: string; steps?: string[] }) {
  const [open, setOpen] = useState(false);

  const cfg = {
    running: { border: "border-blue-200",   bg: "bg-blue-50/50",   text: "text-blue-600",   label: "로그인 진행 중", dot: "bg-blue-400" },
    success: { border: "border-green-200",  bg: "bg-green-50/50",  text: "text-green-600",  label: "로그인 성공",    dot: "bg-green-500" },
    fail:    { border: "border-red-300",    bg: "bg-red-50/50",    text: "text-red-600",    label: "로그인 실패",    dot: "bg-red-500"   },
  }[status];

  const hasDetail = steps && steps.length > 0;

  return (
    <div className={`bg-white rounded-xl border ${cfg.border} overflow-hidden flex-shrink-0`}>
      <button
        onClick={() => hasDetail && setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-4 py-3 gap-2.5 transition-colors duration-200 ${hasDetail ? `hover:${cfg.bg}` : "cursor-default"}`}
      >
        <div className={`flex items-center gap-2.5 ${cfg.text} min-w-0`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
          <span className="text-xs font-semibold flex-shrink-0">{cfg.label}</span>
          {status === "fail" && reason && <span className="text-xs opacity-70 truncate">— {reason}</span>}
        </div>
        {hasDetail && (
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            className={`${cfg.text} flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {open && hasDetail && (
        <div className={`px-4 pb-3 pt-1 border-t ${cfg.border} ${cfg.bg} max-h-48 overflow-y-auto`}>
          {steps!.map((s, i) => (
            <p key={i} className="text-xs text-gray-600 whitespace-pre-line py-1">{s}</p>
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
  canEdit,
  checkedIds,
  onToggleChecked,
  onSelectAll,
  onEditRequest,
  getEffectiveScenario,
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
  canEdit: boolean;
  checkedIds: Set<string>;
  onToggleChecked: (testId: string) => void;
  onSelectAll: () => void;
  onEditRequest: (testId: string) => void;

  getEffectiveScenario: (tc: TestCase) => string;
}) {
  const allChecked = filteredCases.length > 0 && filteredCases.every((c) => checkedIds.has(c.testId));
  const someChecked = filteredCases.some((c) => checkedIds.has(c.testId));

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

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-gray-900">시나리오</h3>
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">
            {filteredCases.length}
          </span>
        </div>
        {canEdit && filteredCases.length > 0 && (
          <button
            onClick={onSelectAll}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 active:scale-95"
            style={{
              color: allChecked ? "#0066cc" : someChecked ? "#0066cc" : "#6b7280",
              background: allChecked ? "rgba(0,102,204,0.08)" : someChecked ? "rgba(0,102,204,0.05)" : "#f5f5f7",
              border: `1px solid ${allChecked || someChecked ? "rgba(0,102,204,0.2)" : "rgba(209,213,219,0.8)"}`,
            }}
          >
            {allChecked ? (
              <>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                전체 해제
              </>
            ) : (
              <>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                전체 선택
              </>
            )}
          </button>
        )}
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
              canEdit={canEdit}
              isChecked={checkedIds.has(tc.testId)}
              onToggleChecked={() => onToggleChecked(tc.testId)}
              onEditRequest={() => onEditRequest(tc.testId)}
              displayScenario={getEffectiveScenario(tc)}
            />
          ))
        )}
      </div>
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
  canEdit,
  isChecked,
  onToggleChecked,
  onEditRequest,
  displayScenario,
}: {
  tc: TestCase;
  isSelected: boolean;
  onClick: () => void;
  isPaused: boolean;
  runId: string;
  onVerify: () => void;
  canEdit: boolean;
  isChecked: boolean;
  onToggleChecked: () => void;
  onEditRequest: () => void;
  displayScenario: string;
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

  const lines = displayScenario.split("\n").filter(Boolean);
  const isLong = displayScenario.length > 90 || lines.length > 2;

  const duration = formatDuration(tc.durationMs);
  const isFail = tc.status === "Fail";

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border-2 p-3.5 cursor-pointer transition-all duration-200 ease-out active:scale-[0.98] ${
        isSelected ? "border-blue-500 bg-blue-50/40 shadow-sm" : "border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {canEdit && (
          <input
            type="checkbox"
            checked={isChecked}
            onClick={(e) => e.stopPropagation()}
            onChange={onToggleChecked}
            className="mt-1 w-4 h-4 flex-shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer transition-transform duration-150 active:scale-90"
          />
        )}
        <div className="flex-shrink-0 mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-gray-900">{tc.testId}</span>
              {canEdit && isFail && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditRequest();
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md transition-all duration-200 active:scale-95 hover:bg-indigo-100"
                >
                  ✏️ 수정
                </button>
              )}
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
            <div className="flex items-center gap-2 flex-shrink-0">
              {duration && (
                <span className="flex items-center gap-1 text-xs font-medium text-gray-400">
                  <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {duration}
                </span>
              )}
            </div>
          </div>
          <p className={`text-sm text-gray-700 whitespace-pre-line ${!expanded ? "line-clamp-2" : ""}`}>
            {displayScenario}
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
                className="text-xs font-semibold px-2.5 py-1 rounded-md bg-green-600 text-white disabled:opacity-50 transition-all duration-200 active:scale-95 hover:bg-green-700"
              >
                승인
              </button>
              <button
                onClick={(e) => handleVerify(e, "rejected")}
                disabled={verifying}
                className="text-xs font-semibold px-2.5 py-1 rounded-md bg-red-600 text-white disabled:opacity-50 transition-all duration-200 active:scale-95 hover:bg-red-700"
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
  const [zoomed, setZoomed] = useState(false);

  const imgSrc = tc?.screenshotBase64
    ? `data:image/png;base64,${tc.screenshotBase64}`
    : tc?.screenshotUrl || null;

  useEffect(() => {
    setZoomed(false);
  }, [imgSrc]);

  return (
    <>
      <div className="bg-gray-100 rounded-xl border border-gray-200 p-6 flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        {!tc ? (
          <p className="text-sm text-gray-400">시나리오를 선택하세요</p>
        ) : imgSrc ? (
          <img
            key={imgSrc}
            src={imgSrc}
            alt="screenshot"
            onClick={() => setZoomed(true)}
            className="max-w-full max-h-full object-contain rounded-lg shadow-sm animate-[fadeIn_0.25s_ease-out] cursor-zoom-in transition-transform duration-200 hover:scale-[1.01]"
          />
        ) : (
          <p className="text-sm text-gray-400">
            {!isTerminal && tc.status === "Pending" ? "실행 대기 중…" : "미디어 없음"}
          </p>
        )}
      </div>

      {zoomed && imgSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8 animate-[fadeIn_0.15s_ease-out] cursor-zoom-out"
          onClick={() => setZoomed(false)}
        >
          <img
            src={imgSrc}
            alt="screenshot-zoomed"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setZoomed(false)}
            className="absolute top-5 right-5 text-white/80 hover:text-white transition-colors duration-200 p-2 rounded-full hover:bg-white/10"
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT: Timeline Card
// ─────────────────────────────────────────────────────────────────────────────

function TimelineCard({
  tc,
  runId,
  targetUrl,
  createdAt,
}: {
  tc: TestCase | null;
  runId: string;
  targetUrl?: string;
  createdAt: string;
}) {
  const logs = tc?.consoleLogs ?? [];
  const [copied, setCopied] = useState(false);

  const handleCopyReport = async () => {
    if (!tc) return;
    const report = buildErrorReportMarkdown(tc, { runId, targetUrl, createdAt });
    try {
      await navigator.clipboard.writeText(report);
    } catch {
      const el = document.createElement("textarea");
      el.value = report;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-base font-bold text-gray-900">실행 타임라인</h3>
        {tc?.status === "Fail" && (
          <button
            onClick={handleCopyReport}
            disabled={copied}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-200 active:scale-95 ${
              copied
                ? "border-green-300 text-green-600 bg-green-50"
                : "border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700"
            }`}
          >
            {copied ? (
              <>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                복사 완료
              </>
            ) : (
              <>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                에러 리포트 복사
              </>
            )}
          </button>
        )}
      </div>

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

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING ACTION BAR — 선택된 시나리오 일괄 재시도
// ─────────────────────────────────────────────────────────────────────────────

function FloatingActionBar({
  count,
  onRetry,
  onCancel,
  retrying,
}: {
  count: number;
  onRetry: () => void;
  onCancel: () => void;
  retrying: boolean;
}) {
  const visible = count > 0;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 ease-out ${
        visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <div className="flex items-center gap-3 bg-gray-900 text-white rounded-full shadow-xl pl-5 pr-2 py-2">
        <span className="text-sm font-medium whitespace-nowrap">{count}개 시나리오 선택됨</span>
        <button
          onClick={onCancel}
          className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors duration-200 whitespace-nowrap"
        >
          선택 해제
        </button>
        <button
          onClick={onRetry}
          disabled={retrying}
          className="flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-full transition-all duration-200 active:scale-95 whitespace-nowrap disabled:opacity-60"
          style={{ background: retrying ? "#0055b3" : "#0066cc" }}
          onMouseEnter={(e) => { if (!retrying) e.currentTarget.style.background = "#0055b3"; }}
          onMouseLeave={(e) => { if (!retrying) e.currentTarget.style.background = "#0066cc"; }}
        >
          {retrying ? (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="animate-spin">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              재시도 중…
            </>
          ) : (
            <>
              선택 시나리오 재시도
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO EDIT MODAL — 단계별 인터랙티브 에디터
// ─────────────────────────────────────────────────────────────────────────────

function ScenarioEditModal({
  testId,
  scenarioText,
  onClose,
  onApply,
}: {
  testId: string;
  scenarioText: string;
  onClose: () => void;
  onApply: (newScenarioText: string) => void;
}) {
  const [steps, setSteps] = useState<ScenarioStep[]>(() => parseScenarioToSteps(scenarioText));

  const updateStep = (id: string, patch: Partial<ScenarioStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { id: nextStepId(), actionType: "click", target: "" }]);
  };

  const handleApply = () => {
    const cleaned = steps.filter((s) => s.target.trim().length > 0);
    onApply(stepsToScenarioText(cleaned));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[80vh] flex flex-col mx-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">시나리오 수정</h2>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{testId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded-md hover:bg-gray-100"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Body: Step editor */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-2.5">
            {steps.map((step, i) => (
              <div key={step.id} className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-400 w-5 flex-shrink-0">{i + 1}.</span>
                <select
                  value={step.actionType}
                  onChange={(e) => updateStep(step.id, { actionType: e.target.value as StepActionType })}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-2 flex-shrink-0 w-32 transition-colors duration-200 focus:border-indigo-400 focus:outline-none"
                >
                  {ACTION_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={step.target}
                  onChange={(e) => updateStep(step.id, { target: e.target.value })}
                  placeholder="대상 또는 값을 입력하세요"
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 flex-1 min-w-0 transition-colors duration-200 focus:border-indigo-400 focus:outline-none"
                />
                <button
                  onClick={() => removeStep(step.id)}
                  className="text-gray-400 hover:text-red-500 flex-shrink-0 p-1.5 rounded-md transition-all duration-200 active:scale-90 hover:bg-red-50"
                >
                  🗑️
                </button>
              </div>
            ))}

            <button
              onClick={addStep}
              className="mt-1 w-full py-2.5 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 text-sm font-medium transition-all duration-200 hover:border-indigo-300 hover:text-indigo-500 active:scale-[0.98]"
            >
              + 단계 추가
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="text-sm font-semibold px-4 py-2 rounded-lg border border-gray-300 text-gray-600 transition-all duration-200 active:scale-95 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleApply}
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white transition-all duration-200 active:scale-95 hover:bg-indigo-700"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
