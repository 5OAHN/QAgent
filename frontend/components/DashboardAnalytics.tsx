"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

/* ─── Mock 데이터 — 추후 /api/history 집계 결과로 교체 예정 ───────── */
const TREND_DATA = [
  { date: "06.20", pass: 8,  fail: 1 },
  { date: "06.21", pass: 11, fail: 2 },
  { date: "06.22", pass: 6,  fail: 0 },
  { date: "06.23", pass: 14, fail: 3 },
  { date: "06.24", pass: 9,  fail: 1 },
  { date: "06.25", pass: 12, fail: 2 },
  { date: "06.26", pass: 10, fail: 1 },
];

const RECENT_FAILURES = [
  { runId: "mock-1", testId: "V-003", scenario: "로그인 후 결제 페이지 진입 확인", failedAt: "2026-06-26T03:12:00Z", reason: "로그인 버튼 탐색 실패" },
  { runId: "mock-2", testId: "V-001", scenario: "회원가입 약관 동의 체크박스 클릭", failedAt: "2026-06-25T11:40:00Z", reason: "체크박스 요소를 찾지 못함" },
  { runId: "mock-3", testId: "N-002", scenario: "장바구니 상품 수량 변경 후 합계 확인", failedAt: "2026-06-25T08:05:00Z", reason: "합계 텍스트 불일치" },
  { runId: "mock-4", testId: "V-005", scenario: "검색 결과 필터 적용 확인", failedAt: "2026-06-24T15:50:00Z", reason: "페이지 로딩 타임아웃" },
];

const EXEC_TIME_TREND = [
  { i: 1, seconds: 102 }, { i: 2, seconds: 95 }, { i: 3, seconds: 110 },
  { i: 4, seconds: 88 },  { i: 5, seconds: 91 }, { i: 6, seconds: 80 },
  { i: 7, seconds: 84 },
];
const AVG_EXEC_SECONDS = 84;
const AVG_EXEC_CHANGE_PCT = -12; // 음수 = 개선(시간 감소)

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "방금 전";
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

const cardClass = "bg-white rounded-xl shadow-sm border border-gray-100";

export default function DashboardAnalytics() {
  return (
    <div className="mt-8 grid grid-cols-3 gap-4">
      <TrendWidget />
      <RecentFailuresWidget />
      <AvgExecTimeWidget />
    </div>
  );
}

/* ── 위젯 1: 일자별 Pass/Fail 트렌드 ───────────────────────────── */
function TrendWidget() {
  const [range, setRange] = useState<"7d">("7d");

  return (
    <div className={`${cardClass} col-span-2 row-span-2 p-5 flex flex-col`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[13px] font-semibold text-gray-900">일자별 테스트 성공률 트렌드</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Pass / Fail 비율 변화</p>
        </div>
        <button
          onClick={() => setRange("7d")}
          className="text-[11px] font-medium px-2.5 py-1 rounded-full"
          style={{ background: "rgba(0,102,204,0.08)", color: COLOR.blue, border: `1px solid rgba(0,102,204,0.15)` }}
        >
          최근 7일
        </button>
      </div>

      <div className="flex-1 min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={TREND_DATA} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
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
function RecentFailuresWidget() {
  const router = useRouter();

  return (
    <div className={`${cardClass} col-span-1 p-5`}>
      <p className="text-[13px] font-semibold text-gray-900 mb-1">요주의 실패 시나리오</p>
      <p className="text-[11px] text-gray-400 mb-3">최근 Fail 발생 {RECENT_FAILURES.length}건</p>

      <div className="flex flex-col gap-1.5">
        {RECENT_FAILURES.map((f) => (
          <button
            key={f.runId}
            onClick={() => router.push(`/dashboard/${f.runId}`)}
            className="w-full text-left rounded-lg px-2.5 py-2 transition-colors hover:bg-gray-50"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-gray-900 truncate">{f.testId}</span>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelativeTime(f.failedAt)}</span>
            </div>
            <p className="text-[11px] text-gray-500 truncate mt-0.5">{f.scenario}</p>
            <span
              className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
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
function AvgExecTimeWidget() {
  const improved = AVG_EXEC_CHANGE_PCT < 0;

  return (
    <div className={`${cardClass} col-span-1 p-5 flex flex-col`}>
      <p className="text-[13px] font-semibold text-gray-900 mb-1">평균 시나리오 소요 시간</p>
      <p className="text-[28px] font-semibold mt-1" style={{ color: COLOR.ink, letterSpacing: "-0.5px" }}>
        {formatDuration(AVG_EXEC_SECONDS)}
      </p>
      <p className="text-[12px] font-medium mt-0.5" style={{ color: improved ? COLOR.green : COLOR.red }}>
        {improved ? "↓" : "↑"} {Math.abs(AVG_EXEC_CHANGE_PCT)}% {improved ? "개선됨" : "증가함"}
      </p>

      <div className="flex-1 min-h-[60px] mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={EXEC_TIME_TREND}>
            <XAxis dataKey="i" hide />
            <YAxis hide domain={["dataMin - 10", "dataMax + 10"]} />
            <Line type="monotone" dataKey="seconds" stroke={COLOR.blue} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
