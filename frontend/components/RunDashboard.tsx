"use client";

import useSWR from "swr";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type RunStatus = "running" | "completed" | "failed";
type ControlAction = "cancel" | "pause" | "resume";
type CaseStatus = "Pass" | "Fail" | "Pending";

interface TestCase {
  testId: string;
  feature: string;
  scenario: string;
  status: CaseStatus;
  failReason: string;
  videoUrl: string;
  screenshotUrl: string;
  consoleLogs?: string[];
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
}

const TERMINAL: RunStatus[] = ["completed", "failed"];
const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function RunDashboard({ runId }: { runId: string }) {
  const router = useRouter();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const prevPendingRef = useRef<Set<string>>(new Set());

  const { data, error, isLoading, mutate } = useSWR<RunResult>(
    `/api/status?run_id=${runId}`,
    fetcher,
    {
      refreshInterval: (d) => (d?.status && TERMINAL.includes(d.status) ? 0 : 3000),
      revalidateOnFocus: true,
      refreshWhenHidden: false,
    }
  );

  // 실행 중인 케이스는 자동 펼침, 완료되면 자동 접힘
  useEffect(() => {
    if (!data?.cases) return;
    setExpandedRows((prev) => {
      const next = new Set(prev);
      const currentPending = new Set(
        data.cases.filter((c) => c.status === "Pending").map((c) => c.testId)
      );
      // 새로 Pending이 된 케이스 펼침
      currentPending.forEach((id) => next.add(id));
      // Pending에서 빠진 케이스(완료) 접힘
      prevPendingRef.current.forEach((id) => {
        if (!currentPending.has(id)) next.delete(id);
      });
      prevPendingRef.current = currentPending;
      return next;
    });
  }, [data?.cases]);

  const toggleRow = (testId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(testId) ? next.delete(testId) : next.add(testId);
      return next;
    });
  };

  const sendControl = async (action: ControlAction) => {
    await fetch(`/api/run/${runId}/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await mutate();
  };

  if (isLoading) return <Shell><Spinner /></Shell>;
  if (error || !data) return <Shell><ErrorBox msg={error?.message || "데이터를 불러올 수 없습니다."} /></Shell>;

  const done = data.passed + data.failed;
  const progress = data.total > 0 ? Math.round((done / data.total) * 100) : 0;
  const isTerminal = TERMINAL.includes(data.status);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ── 고정 헤더 영역 ── */}
      <div className="shrink-0 border-b border-[#1a1a1a] bg-[#090909] px-6 py-4">
        {/* 상단 행: 타이틀 + 컨트롤 버튼 */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <Link href="/" className="mb-1 block text-xs text-[#0099ff] hover:underline">
              ← 새 테스트
            </Link>
            <h1 className="text-xl font-medium text-white" style={{ letterSpacing: "-0.5px" }}>
              실행 결과
            </h1>
            <p className="text-xs text-[#555]">
              {new Date(data.createdAt).toLocaleString("ko-KR")} · {runId.slice(0, 8)}…
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={data.status} paused={data.paused} />
            {!isTerminal && (
              <>
                {data.paused ? (
                  <button
                    onClick={() => sendControl("resume")}
                    className="rounded-full border border-[#0099ff]/40 bg-[#0099ff]/10 px-3 py-1 text-xs text-[#0099ff] transition-colors hover:bg-[#0099ff]/20"
                  >
                    ▶ 재개
                  </button>
                ) : (
                  <button
                    onClick={() => sendControl("pause")}
                    className="rounded-full border border-[#262626] bg-[#141414] px-3 py-1 text-xs text-[#999] transition-colors hover:border-[#ffaa00] hover:text-[#ffaa00]"
                  >
                    ⏸ 일시정지
                  </button>
                )}
                <button
                  onClick={() => sendControl("cancel")}
                  className="rounded-full border border-[#262626] bg-[#141414] px-3 py-1 text-xs text-[#999] transition-colors hover:border-red-500 hover:text-red-400"
                >
                  ■ 중지
                </button>
              </>
            )}
            {data.mode === "natural" && data.targetUrl && data.scenarios && isTerminal && (
              <button
                onClick={() => {
                  const params = new URLSearchParams({
                    url: data.targetUrl!,
                    scenarios: data.scenarios!,
                  });
                  router.push(`/?${params.toString()}`);
                }}
                className="rounded-full border border-[#262626] bg-[#141414] px-3 py-1 text-xs text-[#999] transition-colors hover:border-[#0099ff] hover:text-[#0099ff]"
              >
                수정 후 재시도 ↩
              </button>
            )}
          </div>
        </div>

        {/* 진행률 바 */}
        <div className="mb-3 space-y-1.5">
          <div className="flex justify-between text-xs text-[#555]">
            <span>{done} / {data.total} 케이스</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-[#1c1c1c]">
            <div
              className="h-full rounded-full bg-[#0099ff] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 요약 수치 */}
        <div className="grid grid-cols-3 gap-2">
          <SummaryChip label="전체" value={data.total} color="text-white" />
          <SummaryChip label="Pass" value={data.passed} color="text-green-400" />
          <SummaryChip label="Fail" value={data.failed} color="text-red-400" />
        </div>

        {/* 오류 */}
        {data.error && <div className="mt-3"><ErrorBox msg={data.error} /></div>}
      </div>

      {/* ── 스크롤 가능한 테이블 영역 ── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* 지시 내용 */}
        {data.mode === "natural" && (data.targetUrl || data.scenarios) && (
          <div className="mx-6 mt-4 rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] p-4 space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-widest text-[#555]">지시 내용</p>
            {data.targetUrl && (
              <p className="text-xs text-[#555]">
                URL: <span className="text-[#0099ff]">{data.targetUrl}</span>
              </p>
            )}
            {data.scenarios && (
              <pre className="whitespace-pre-wrap text-xs text-[#999] leading-relaxed">{data.scenarios}</pre>
            )}
          </div>
        )}

        {/* 케이스 테이블 */}
        <div className="mx-6 my-4 overflow-hidden rounded-xl border border-[#1a1a1a]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[#141414] text-left text-xs text-[#666]">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">시나리오</th>
                <th className="px-4 py-3 font-medium">결과</th>
                <th className="px-4 py-3 font-medium">상세</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {data.cases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-[#555]">
                    {!isTerminal ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-[#0099ff]" />
                        테스트 케이스를 준비하는 중…
                      </span>
                    ) : "케이스 없음"}
                  </td>
                </tr>
              ) : (
                data.cases.map((tc) => (
                  <CaseRow
                    key={tc.testId}
                    tc={tc}
                    isExpanded={expandedRows.has(tc.testId)}
                    onToggle={() => toggleRow(tc.testId)}
                    isPaused={!!data.paused}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 아코디언 케이스 행 ──────────────────────────────────────────────────
function CaseRow({
  tc,
  isExpanded,
  onToggle,
  isPaused,
}: {
  tc: TestCase;
  isExpanded: boolean;
  onToggle: () => void;
  isPaused: boolean;
}) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const hasLogs = (tc.consoleLogs?.length ?? 0) > 0;
  const isRunning = tc.status === "Pending";

  // 로그가 추가될 때 자동 스크롤
  useEffect(() => {
    if (isExpanded && isRunning) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [tc.consoleLogs?.length, isExpanded, isRunning]);

  return (
    <>
      <tr
        className={`cursor-pointer bg-[#090909] transition-colors hover:bg-[#0f0f0f] ${isExpanded ? "bg-[#0d0d0d]" : ""}`}
        onClick={onToggle}
      >
        {/* ID */}
        <td className="px-4 py-3 font-mono text-xs text-[#555]">
          <span className="flex items-center gap-1.5">
            {isRunning && (
              <span className="h-1.5 w-1.5 shrink-0 animate-ping rounded-full bg-[#0099ff]" />
            )}
            {tc.testId}
          </span>
        </td>
        {/* 시나리오 */}
        <td className="px-4 py-3 text-[#ccc]">
          <span className="line-clamp-2 text-sm">{tc.scenario}</span>
        </td>
        {/* 결과 */}
        <td className="px-4 py-3">
          {tc.status === "Pending" ? (
            <span className="text-xs text-[#555]">실행 중…</span>
          ) : (
            <ResultBadge status={tc.status} />
          )}
        </td>
        {/* 상세 링크 */}
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap items-center gap-2">
            {tc.failReason && !isExpanded && (
              <span className="max-w-[160px] truncate text-xs text-red-400" title={tc.failReason}>
                {tc.failReason}
              </span>
            )}
            {tc.videoUrl && (
              <a
                href={tc.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-full bg-[#141414] px-2 py-0.5 text-xs text-[#0099ff] hover:underline"
              >
                영상 ↗
              </a>
            )}
            {tc.screenshotUrl && (
              <a
                href={tc.screenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-full bg-[#141414] px-2 py-0.5 text-xs text-[#999] hover:underline"
              >
                스냅샷 ↗
              </a>
            )}
          </div>
        </td>
        {/* 토글 아이콘 */}
        <td className="px-4 py-3 text-center">
          {hasLogs || isRunning ? (
            <span className="text-[#555] transition-transform duration-200" style={{ display: "inline-block", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
              ⌄
            </span>
          ) : (
            <span className="text-[#2a2a2a]">—</span>
          )}
        </td>
      </tr>

      {/* 펼침: 로그 박스 */}
      {isExpanded && (hasLogs || isRunning) && (
        <tr className="bg-[#0a0a0a]">
          <td colSpan={5} className="px-4 pb-3 pt-0">
            <div className="rounded-lg border border-[#1e1e1e] bg-[#0d0d0d] p-3 font-mono text-xs max-h-56 overflow-y-auto">
              {/* 실패 이유 */}
              {tc.failReason && (
                <div className="mb-2 flex items-start gap-2 rounded bg-red-950/30 px-2 py-1.5 text-red-400">
                  <span className="shrink-0">✗</span>
                  <span>{tc.failReason}</span>
                </div>
              )}
              {/* 스텝 로그 */}
              {tc.consoleLogs?.map((log, i) => (
                <div key={i} className="flex items-start gap-2 py-0.5">
                  <span className="shrink-0 text-[#333]">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[#888]">{log}</span>
                </div>
              ))}
              {/* 실행 중 인디케이터 */}
              {isRunning && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[#444]">
                  {isPaused ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                      <span className="text-yellow-700">일시정지됨</span>
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0099ff]" />
                      <span>분석 중…</span>
                    </>
                  )}
                </div>
              )}
              <div ref={logEndRef} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-5xl p-6">{children}</main>;
}

function StatusBadge({ status, paused }: { status: RunStatus; paused?: boolean }) {
  if (status === "running" && paused) {
    return <span className="rounded-full bg-yellow-900/40 px-3 py-1 text-xs font-medium text-yellow-300">일시정지</span>;
  }
  const map: Record<RunStatus, { cls: string; label: string }> = {
    running:   { cls: "bg-blue-900/50 text-blue-300 animate-pulse", label: "실행 중" },
    completed: { cls: "bg-green-900/50 text-green-300", label: "완료" },
    failed:    { cls: "bg-red-900/50 text-red-300", label: "오류" },
  };
  const { cls, label } = map[status];
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}>{label}</span>;
}

function ResultBadge({ status }: { status: "Pass" | "Fail" }) {
  return status === "Pass"
    ? <span className="rounded-full bg-green-900/40 px-2.5 py-0.5 text-xs font-medium text-green-300">Pass</span>
    : <span className="rounded-full bg-red-900/40 px-2.5 py-0.5 text-xs font-medium text-red-300">Fail</span>;
}

function SummaryChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[#141414] px-3 py-2">
      <span className="text-xs text-[#555]">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}

function Spinner() {
  return <div className="flex h-40 items-center justify-center text-[#555]">불러오는 중…</div>;
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-xl border border-red-800/30 bg-red-950/20 px-4 py-3 text-sm text-red-400">
      {msg}
    </div>
  );
}
