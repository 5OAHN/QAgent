"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";

/* ─── 색상 (기존 Apple 디자인 토큰과 통일) ───────────────────────── */
const COLOR = {
  blue:  "#0066cc",
  green: "#16a34a",
  red:   "#dc2626",
  ink:   "#1d1d1f",
  inkMuted: "#6b7280",
  hairline: "#e0e0e0",
};

/* ─── 워커가 저장하는 RunResult / TestResult 형태 ─────────────────── */
interface TestResult {
  testId: string;
  feature: string;
  scenario: string;
  status: "Pass" | "Fail" | "Pending";
  failReason: string;
  consoleLogs: string[];
  durationMs?: number;
  completedAt?: string;
}

interface RunResult {
  runId: string;
  status: "running" | "completed" | "failed";
  total: number;
  passed: number;
  failed: number;
  cases: TestResult[];
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "방금 전";
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// 백엔드/API의 원시 에러 메시지(JSON, 영문 코드 등)를 사람이 읽을 수 있는 한글 사유로 변환
// (상세 결과 페이지의 humanizeFailReason과 동일한 규칙)
function humanizeFailReason(raw?: string): string {
  if (!raw) return "알 수 없는 오류";
  if (/GEMINI_QUOTA_EXCEEDED/i.test(raw) || /quota.*exceeded/i.test(raw)) {
    return "Gemini API 할당량 초과";
  }
  if (/All providers failed/i.test(raw)) {
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
  // 원문이 너무 길면 앞 30자만
  return raw.length > 30 ? raw.slice(0, 30) + "…" : raw;
}

const cardClass = "bg-white rounded-xl shadow-sm border border-gray-100";

/* ─── 집계 로직 ───────────────────────────────────────────────────── */
interface CaseWithRun extends TestResult {
  runId: string;
  runCreatedAt: string;
}

function flattenCases(runs: RunResult[]): CaseWithRun[] {
  return runs.flatMap((run) =>
    (run.cases || []).map((c) => ({ ...c, runId: run.runId, runCreatedAt: run.createdAt }))
  );
}

function caseTimestamp(c: CaseWithRun): string {
  return c.completedAt || c.runCreatedAt;
}

function buildTrend(cases: CaseWithRun[]) {
  const days: { date: string; pass: number; fail: number }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push({ date: dateKey(d.toISOString()), pass: 0, fail: 0 });
  }
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - 6);
  cutoff.setHours(0, 0, 0, 0);

  for (const c of cases) {
    if (c.status === "Pending") continue;
    const ts = caseTimestamp(c);
    const t = new Date(ts);
    if (t < cutoff) continue;
    const key = dateKey(ts);
    const bucket = days.find((d) => d.date === key);
    if (!bucket) continue;
    if (c.status === "Pass") bucket.pass++;
    else if (c.status === "Fail") bucket.fail++;
  }
  return days;
}

function buildRecentFailures(cases: CaseWithRun[]) {
  return cases
    .filter((c) => c.status === "Fail")
    .sort((a, b) => new Date(caseTimestamp(b)).getTime() - new Date(caseTimestamp(a)).getTime())
    .slice(0, 4)
    .map((c) => ({
      runId: c.runId,
      testId: c.testId,
      scenario: c.scenario,
      failedAt: caseTimestamp(c),
      reason: humanizeFailReason(c.failReason),
    }));
}

function buildExecTime(cases: CaseWithRun[]) {
  const timed = cases.filter((c) => typeof c.durationMs === "number");

  const byDay = new Map<string, { totalMs: number; count: number; sortKey: number }>();
  for (const c of timed) {
    const ts = caseTimestamp(c);
    const key = dateKey(ts);
    const entry = byDay.get(key) || { totalMs: 0, count: 0, sortKey: new Date(ts).getTime() };
    entry.totalMs += c.durationMs!;
    entry.count += 1;
    entry.sortKey = Math.max(entry.sortKey, new Date(ts).getTime());
    byDay.set(key, entry);
  }
  const trend = Array.from(byDay.entries())
    .sort((a, b) => a[1].sortKey - b[1].sortKey)
    .slice(-7)
    .map(([date, v], i) => ({ i: i + 1, date, seconds: Math.round(v.totalMs / v.count / 1000) }));

  const now = Date.now();
  const sevenDaysMs = 1000 * 60 * 60 * 24 * 7;
  const recent = timed.filter((c) => now - new Date(caseTimestamp(c)).getTime() <= sevenDaysMs);
  const prior = timed.filter((c) => {
    const age = now - new Date(caseTimestamp(c)).getTime();
    return age > sevenDaysMs && age <= sevenDaysMs * 2;
  });

  const avg = (arr: CaseWithRun[]) =>
    arr.length ? arr.reduce((sum, c) => sum + (c.durationMs || 0), 0) / arr.length / 1000 : null;

  const avgSeconds = avg(recent);
  const priorAvgSeconds = avg(prior);
  const changePct =
    avgSeconds !== null && priorAvgSeconds !== null && priorAvgSeconds > 0
      ? Math.round(((avgSeconds - priorAvgSeconds) / priorAvgSeconds) * 100)
      : null;

  return { trend, avgSeconds, changePct, hasData: timed.length > 0 };
}

export default function DashboardAnalytics() {
  const { data: runs, isLoading } = useSWR<RunResult[]>("/api/history", fetcher, {
    refreshInterval: 15000,
  });

  const cases = flattenCases(runs || []);
  const trendData = buildTrend(cases);
  const recentFailures = buildRecentFailures(cases);
  const execTime = buildExecTime(cases);
  const hasAnyCases = cases.length > 0;

  return (
    <div className="mt-8 grid grid-cols-3 gap-4 items-start">
      <TrendWidget data={trendData} loading={isLoading} hasData={hasAnyCases} />
      <RecentFailuresWidget failures={recentFailures} loading={isLoading} />
      <AvgExecTimeWidget
        avgSeconds={execTime.avgSeconds}
        changePct={execTime.changePct}
        trend={execTime.trend}
        loading={isLoading}
        hasData={execTime.hasData}
      />
    </div>
  );
}

/* ── 위젯 1: 일자별 Pass/Fail 트렌드 ───────────────────────────── */
function TrendWidget({
  data,
  loading,
  hasData,
}: {
  data: { date: string; pass: number; fail: number }[];
  loading: boolean;
  hasData: boolean;
}) {
  return (
    <div className={`${cardClass} col-span-2 p-5 flex flex-col`} style={{ height: 280 }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[13px] font-semibold text-gray-900">일자별 테스트 성공률 트렌드</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Pass / Fail 비율 변화</p>
        </div>
        <span
          className="text-[11px] font-medium px-2.5 py-1 rounded-full"
          style={{ background: "rgba(0,102,204,0.08)", color: COLOR.blue, border: `1px solid rgba(0,102,204,0.15)` }}
        >
          최근 7일
        </span>
      </div>

      <div className="flex-1 min-h-[220px] flex items-center justify-center">
        {loading ? (
          <p className="text-[12px] text-gray-400">불러오는 중…</p>
        ) : !hasData ? (
          <p className="text-[12px] text-gray-400">아직 실행 이력이 없습니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="passGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR.green} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={COLOR.green} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="failGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR.red} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={COLOR.red} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: COLOR.inkMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: COLOR.inkMuted }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<TrendTooltip />} />
              <Area type="monotone" dataKey="pass" name="Pass" stroke={COLOR.green} strokeWidth={2} fill="url(#passGradient)" />
              <Area type="monotone" dataKey="fail" name="Fail" stroke={COLOR.red} strokeWidth={2} fill="url(#failGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 px-3 py-2 text-[12px]">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}</span>
          <span className="font-semibold text-gray-900 ml-auto">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── 위젯 3: 요주의 실패 시나리오 리스트 ────────────────────────── */
function RecentFailuresWidget({
  failures,
  loading,
}: {
  failures: { runId: string; testId: string; scenario: string; failedAt: string; reason: string }[];
  loading: boolean;
}) {
  const router = useRouter();

  return (
    <div className={`${cardClass} col-span-1 p-5 flex flex-col`} style={{ minHeight: 0 }}>
      <p className="text-[13px] font-semibold text-gray-900 mb-1">요주의 실패 시나리오</p>
      <p className="text-[11px] text-gray-400 mb-3 flex-shrink-0">
        {loading ? "불러오는 중…" : `최근 Fail 발생 ${failures.length}건`}
      </p>

      {!loading && failures.length === 0 && (
        <p className="text-[12px] text-gray-400 py-4 text-center">실패한 테스트가 없습니다.</p>
      )}

      <div className="flex flex-col gap-1 overflow-y-auto flex-1">
        {failures.map((f) => (
          <button
            key={`${f.runId}-${f.testId}`}
            onClick={() => router.push(`/dashboard/${f.runId}`)}
            className="w-full text-left rounded-lg px-2.5 py-2 transition-colors hover:bg-gray-50 flex-shrink-0"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-gray-900 truncate">{f.testId}</span>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelativeTime(f.failedAt)}</span>
            </div>
            <p className="text-[11px] text-gray-500 truncate mt-0.5">{f.scenario}</p>
            <span
              className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full truncate max-w-full"
              style={{ background: "rgba(220,38,38,0.08)", color: COLOR.red, border: "1px solid rgba(220,38,38,0.18)" }}
            >
              {f.reason}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── 위젯 4: 평균 시나리오 소요 시간 ────────────────────────────── */
function AvgExecTimeWidget({
  avgSeconds,
  changePct,
  trend,
  loading,
  hasData,
}: {
  avgSeconds: number | null;
  changePct: number | null;
  trend: { i: number; seconds: number }[];
  loading: boolean;
  hasData: boolean;
}) {
  const improved = (changePct ?? 0) < 0;

  return (
    <div className={`${cardClass} col-span-1 p-5 flex flex-col`}>
      <p className="text-[13px] font-semibold text-gray-900 mb-1">평균 시나리오 소요 시간</p>

      {loading ? (
        <p className="text-[12px] text-gray-400 mt-2">불러오는 중…</p>
      ) : !hasData ? (
        <p className="text-[12px] text-gray-400 mt-2">아직 측정된 실행 시간이 없습니다.</p>
      ) : (
        <>
          <p className="text-[28px] font-semibold mt-1" style={{ color: COLOR.ink, letterSpacing: "-0.5px" }}>
            {formatDuration(avgSeconds ?? 0)}
          </p>
          {changePct !== null ? (
            <p className="text-[12px] font-medium mt-0.5" style={{ color: improved ? COLOR.green : COLOR.red }}>
              {improved ? "↓" : "↑"} {Math.abs(changePct)}% {improved ? "개선됨" : "증가함"}
            </p>
          ) : (
            <p className="text-[12px] text-gray-400 mt-0.5">전주 대비 데이터 부족</p>
          )}

          <div className="flex-1 min-h-[60px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <XAxis dataKey="i" hide />
                <YAxis hide domain={["dataMin - 10", "dataMax + 10"]} />
                <Line type="monotone" dataKey="seconds" stroke={COLOR.blue} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
