"use client";

import useSWR from "swr";
import Link from "next/link";

type RunStatus = "running" | "completed" | "failed";
type CaseStatus = "Pass" | "Fail" | "Pending";

interface TestCase {
  testId: string;
  feature: string;
  scenario: string;
  status: CaseStatus;
  failReason: string;
  videoUrl: string;
  screenshotUrl: string;
}

interface RunResult {
  runId: string;
  status: RunStatus;
  total: number;
  passed: number;
  failed: number;
  createdAt: string;
  cases: TestCase[];
  error?: string;
}

const TERMINAL: RunStatus[] = ["completed", "failed"];
const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function RunDashboard({ runId }: { runId: string }) {
  const { data, error, isLoading } = useSWR<RunResult>(
    `/api/status?run_id=${runId}`,
    fetcher,
    {
      refreshInterval: (d) => (TERMINAL.includes(d?.status) ? 0 : 3000),
      revalidateOnFocus: true,
      refreshWhenHidden: false,
    }
  );

  if (isLoading) return <Shell><Spinner /></Shell>;
  if (error || !data) return <Shell><ErrorBox msg={error?.message || "데이터를 불러올 수 없습니다."} /></Shell>;

  const done = data.passed + data.failed;
  const progress = data.total > 0 ? Math.round((done / data.total) * 100) : 0;
  const isTerminal = TERMINAL.includes(data.status);

  return (
    <Shell>
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/" className="mb-1 block text-xs text-[#0099ff] hover:underline">
            ← 새 테스트
          </Link>
          <h1 className="text-2xl font-medium" style={{ letterSpacing: "-1px" }}>
            실행 결과
          </h1>
          <p className="text-xs text-[#666]">
            {new Date(data.createdAt).toLocaleString("ko-KR")} · {runId.slice(0, 8)}…
          </p>
        </div>
        <StatusBadge status={data.status} />
      </div>

      {/* 진행률 */}
      {!isTerminal && (
        <div className="mb-6 space-y-1.5">
          <div className="flex justify-between text-xs text-[#666]">
            <span>{done} / {data.total} 완료</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-[#1c1c1c]">
            <div
              className="h-full rounded-full bg-[#0099ff] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-[#444]">3초마다 자동 갱신 중…</p>
        </div>
      )}

      {/* 요약 카드 */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Card label="전체" value={data.total} color="text-white" />
        <Card label="Pass" value={data.passed} color="text-green-400" />
        <Card label="Fail" value={data.failed} color="text-red-400" />
      </div>

      {/* 오류 */}
      {data.error && <ErrorBox msg={data.error} />}

      {/* 케이스 테이블 */}
      <div className="overflow-hidden rounded-xl border border-[#1a1a1a]">
        <table className="w-full text-sm">
          <thead className="bg-[#141414] text-left text-xs text-[#666]">
            <tr>
              {["ID", "기능", "시나리오", "결과", "상세"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]">
            {data.cases.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-[#444]">
                  테스트 케이스를 실행하는 중…
                </td>
              </tr>
            ) : (
              data.cases.map((tc) => <CaseRow key={tc.testId} tc={tc} />)
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function CaseRow({ tc }: { tc: TestCase }) {
  return (
    <tr className="bg-[#090909] transition-colors hover:bg-[#0f0f0f]">
      <td className="px-4 py-3 font-mono text-xs text-[#666]">{tc.testId}</td>
      <td className="px-4 py-3 text-[#999]">{tc.feature}</td>
      <td className="px-4 py-3 text-[#ccc]">{tc.scenario}</td>
      <td className="px-4 py-3">
        {tc.status === "Pending" ? (
          <span className="text-xs text-[#444]">대기 중</span>
        ) : (
          <ResultBadge status={tc.status} />
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {tc.failReason && (
            <span className="max-w-[200px] truncate text-xs text-red-400" title={tc.failReason}>
              {tc.failReason}
            </span>
          )}
          {tc.videoUrl && (
            <a href={tc.videoUrl} target="_blank" rel="noopener noreferrer"
              className="shrink-0 rounded-full bg-[#141414] px-2 py-0.5 text-xs text-[#0099ff] hover:underline">
              영상 ↗
            </a>
          )}
          {tc.screenshotUrl && (
            <a href={tc.screenshotUrl} target="_blank" rel="noopener noreferrer"
              className="shrink-0 rounded-full bg-[#141414] px-2 py-0.5 text-xs text-[#999] hover:underline">
              스냅샷 ↗
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl p-6">{children}</main>
  );
}

function StatusBadge({ status }: { status: RunStatus }) {
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

function Card({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#141414] p-4 text-center">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-[#666]">{label}</p>
    </div>
  );
}

function Spinner() {
  return <div className="flex h-40 items-center justify-center text-[#444]">불러오는 중…</div>;
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="mb-4 rounded-xl border border-red-800/30 bg-red-950/20 px-4 py-3 text-sm text-red-400">
      {msg}
    </div>
  );
}
