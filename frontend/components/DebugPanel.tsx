"use client";

import { useState, useRef, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

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
  status: "running" | "completed" | "failed";
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

interface DebugPanelProps {
  tc: TestCase | null;
  isTerminal: boolean;
  targetUrl?: string;
  data: RunResult;
}

interface ConsoleLogItem {
  stepNum: number;
  action: string;
  status: "success" | "failed" | "pending";
  details: string;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  indigo: "#0066cc",
  indigoDark: "#0055aa",
  indigoBg: "#eff6ff",
  indigoBg2: "#dbeafe",
  green: "#16a34a",
  greenLight: "#4ade80",
  greenBg: "#f0fdf4",
  red: "#dc2626",
  redBg: "#fef2f2",
  amber: "#d97706",
  amberBg: "#fffbeb",
  glass: "#ffffff",
  glassHover: "#f5f5f7",
  border: "#e0e0e0",
  borderSoft: "#f0f0f0",
  text: "#1d1d1f",
  textMid: "#6b7280",
  textLight: "#9ca3af",
  textFaint: "#d1d5db",
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse console log to extract step information.
 * Format: "[Step N] action — details" or "✅ message" or "❌ message"
 */
function parseConsoleLog(log: string): ConsoleLogItem | null {
  // Try parsing structured format: [Step N] action — details
  const m = log.match(/^\[Step (\d+)\]\s+(.+?)\s*—\s*(.+)$/);
  if (m) {
    return {
      stepNum: parseInt(m[1], 10),
      action: m[2].trim(),
      status: "pending",
      details: m[3].trim(),
      timestamp: Date.now(),
    };
  }

  // Try parsing success/fail markers
  if (log.includes("✅")) {
    return {
      stepNum: 0,
      action: log.replace(/✅\s*/, "").trim(),
      status: "success",
      details: "작업 완료",
      timestamp: Date.now(),
    };
  }

  if (log.includes("❌")) {
    return {
      stepNum: 0,
      action: log.replace(/❌\s*/, "").trim(),
      status: "failed",
      details: "작업 실패",
      timestamp: Date.now(),
    };
  }

  // Fallback: treat as pending action
  return {
    stepNum: 0,
    action: log,
    status: "pending",
    details: "",
    timestamp: Date.now(),
  };
}

/**
 * Convert case status to Korean label
 */
function getStatusLabel(status: CaseStatus): string {
  switch (status) {
    case "Pass":
      return "완료";
    case "Fail":
      return "실패";
    case "Pending":
      return "진행 중";
    default:
      return status;
  }
}

/**
 * Get color for status badge
 */
function getStatusColor(status: CaseStatus): {
  bg: string;
  color: string;
  border: string;
} {
  switch (status) {
    case "Pass":
      return { bg: C.greenBg, color: C.green, border: "#bbf7d0" };
    case "Fail":
      return { bg: C.redBg, color: C.red, border: "#fecaca" };
    case "Pending":
      return { bg: C.indigoBg, color: C.indigo, border: "#bfdbfe" };
    default:
      return { bg: C.glass, color: C.textMid, border: C.border };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT: DebugPanel
// ─────────────────────────────────────────────────────────────────────────────

export function DebugPanel({ tc, isTerminal, targetUrl, data }: DebugPanelProps) {
  if (!tc) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        <div className="flex items-center justify-center flex-1 text-gray-400">
          시나리오를 선택하세요
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <DebugHeader tc={tc} targetUrl={targetUrl} data={data} />

      {/* 2-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Timeline & Scenario */}
        <div className="w-2/5 flex flex-col overflow-hidden border-r border-gray-200">
          <ScenarioTimeline tc={tc} />
        </div>

        {/* Right Column: Media Viewer */}
        <div className="w-3/5 flex flex-col overflow-hidden bg-gray-50">
          <MediaViewer tc={tc} isTerminal={isTerminal} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENT: DebugHeader
// ─────────────────────────────────────────────────────────────────────────────

function DebugHeader({
  tc,
  targetUrl,
  data,
}: {
  tc: TestCase;
  targetUrl?: string;
  data: RunResult;
}) {
  const statusColor = getStatusColor(tc.status);
  const statusLabel = getStatusLabel(tc.status);

  // Calculate execution duration (placeholder)
  const duration = "00:00:30";

  return (
    <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          {/* Test ID */}
          <span className="font-mono text-sm font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded">
            {tc.testId}
          </span>

          {/* Status Badge */}
          <span
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{
              background: statusColor.bg,
              color: statusColor.color,
              border: `1px solid ${statusColor.border}`,
            }}
          >
            {statusLabel}
          </span>
        </div>

        {/* Duration and URL */}
        <div className="flex items-center gap-4 text-xs text-gray-600">
          {duration && <span>⏱ {duration}</span>}
          {targetUrl && (
            <span className="truncate max-w-xs" title={targetUrl}>
              {targetUrl}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENT: ScenarioTimeline
// ─────────────────────────────────────────────────────────────────────────────

function ScenarioTimeline({ tc }: { tc: TestCase }) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const logs = tc.consoleLogs ?? [];
  const parsedLogs = logs.map(parseConsoleLog).filter(Boolean) as ConsoleLogItem[];

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Section A: Original Scenario */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200">
        <h3 className="text-xs font-bold text-gray-600 uppercase mb-2 tracking-wider">
          원본 시나리오
        </h3>
        <div className="bg-gray-100 rounded p-3 text-xs text-gray-700 max-h-20 overflow-y-auto font-mono">
          {tc.scenario}
        </div>
      </div>

      {/* Section B: Visual Timeline */}
      <div className="flex-1 flex flex-col overflow-hidden px-4 py-3 border-b border-gray-200">
        <h3 className="text-xs font-bold text-gray-600 uppercase mb-3 tracking-wider">
          실행 타임라인
        </h3>
        <div className="flex-1 overflow-y-auto space-y-1">
          {parsedLogs.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">로그 없음</p>
          ) : (
            parsedLogs.map((log, idx) => (
              <TimelineItem key={idx} log={log} isLast={idx === parsedLogs.length - 1} />
            ))
          )}
        </div>
      </div>

      {/* Section C: Detail Logs Accordion */}
      <div className="flex-shrink-0 border-t border-gray-200">
        <button
          onClick={() => setDetailsOpen(!detailsOpen)}
          className="w-full px-4 py-2 text-xs font-bold text-gray-600 uppercase tracking-wider hover:bg-gray-50 flex items-center justify-between"
        >
          상세 로그
          <span
            className="text-gray-400 transition-transform"
            style={{ transform: detailsOpen ? "rotate(180deg)" : "rotate(0)" }}
          >
            ⌄
          </span>
        </button>

        {detailsOpen && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="text-xs text-gray-600 font-mono bg-white p-2 rounded max-h-32 overflow-y-auto">
              {logs.length > 0 ? (
                logs.map((log, i) => (
                  <div key={i} className="py-1">
                    {log}
                  </div>
                ))
              ) : (
                <span className="text-gray-400">로그 없음</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENT: TimelineItem
// ─────────────────────────────────────────────────────────────────────────────

function TimelineItem({
  log,
  isLast,
}: {
  log: ConsoleLogItem;
  isLast: boolean;
}) {
  const statusIcon =
    log.status === "success"
      ? "✅"
      : log.status === "failed"
        ? "❌"
        : "⏳";

  const statusColor =
    log.status === "success"
      ? C.green
      : log.status === "failed"
        ? C.red
        : C.textLight;

  const bgClass =
    log.status === "failed" ? "bg-red-50" : log.status === "success" ? "bg-green-50" : "";

  return (
    <div className={`flex gap-3 pb-2 ${bgClass} px-2 py-1.5 rounded text-xs`}>
      {/* Status Icon */}
      <div className="flex-shrink-0 pt-0.5 text-sm" style={{ color: statusColor }}>
        {statusIcon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-gray-700 font-medium">{log.action}</div>
        {log.details && (
          <div className="text-gray-500 text-xs mt-0.5">{log.details}</div>
        )}
      </div>

      {/* Connector line (not last) */}
      {!isLast && (
        <div className="absolute left-6 top-full h-1 border-l border-gray-300" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENT: MediaViewer
// ─────────────────────────────────────────────────────────────────────────────

function MediaViewer({
  tc,
  isTerminal,
}: {
  tc: TestCase;
  isTerminal: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && tc?.videoUrl) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [tc?.videoUrl]);

  return (
    <div className="flex flex-col overflow-hidden p-4">
      {/* Conditional rendering based on status */}
      {tc.status === "Fail" && (
        <FailMediaView tc={tc} videoRef={videoRef} />
      )}
      {tc.status === "Pass" && (
        <PassMediaView tc={tc} videoRef={videoRef} />
      )}
      {tc.status === "Pending" && (
        <PendingMediaView />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA VIEW VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

function FailMediaView({
  tc,
  videoRef,
}: {
  tc: TestCase;
  videoRef: React.RefObject<HTMLVideoElement>;
}) {
  return (
    <div className="flex-1 flex flex-col">
      <h3 className="text-xs font-bold text-gray-600 uppercase mb-3 tracking-wider">
        에러 발생 순간
      </h3>

      <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden relative">
        {tc.videoUrl ? (
          <video
            ref={videoRef}
            src={tc.videoUrl}
            controls
            autoPlay
            className="w-full h-full object-contain bg-black"
          />
        ) : tc.screenshotBase64 ? (
          <div className="w-full h-full flex items-center justify-center relative bg-gray-100">
            <img
              src={`data:image/png;base64,${tc.screenshotBase64}`}
              alt="error screenshot"
              className="w-full h-full object-contain"
            />
            {/* Error highlight overlay */}
            <div className="absolute inset-0 border-4 border-red-500 rounded pointer-events-none opacity-70" />
          </div>
        ) : tc.screenshotUrl ? (
          <div className="w-full h-full flex items-center justify-center relative bg-gray-100">
            <img
              src={tc.screenshotUrl}
              alt="error screenshot"
              className="w-full h-full object-contain"
            />
            {/* Error highlight overlay */}
            <div className="absolute inset-0 border-4 border-red-500 rounded pointer-events-none opacity-70" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            미디어 없음
          </div>
        )}
      </div>

      {/* Error reason */}
      {tc.failReason && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <strong>에러 메시지:</strong>
          <p className="mt-1">{tc.failReason}</p>
        </div>
      )}
    </div>
  );
}

function PassMediaView({
  tc,
  videoRef,
}: {
  tc: TestCase;
  videoRef: React.RefObject<HTMLVideoElement>;
}) {
  return (
    <div className="flex-1 flex flex-col">
      <h3 className="text-xs font-bold text-gray-600 uppercase mb-3 tracking-wider">
        최종 완료 화면
      </h3>

      <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
        {tc.videoUrl ? (
          <video
            ref={videoRef}
            src={tc.videoUrl}
            controls
            autoPlay
            className="w-full h-full object-contain bg-black"
          />
        ) : tc.screenshotBase64 ? (
          <img
            src={`data:image/png;base64,${tc.screenshotBase64}`}
            alt="success screenshot"
            className="w-full h-full object-contain"
          />
        ) : tc.screenshotUrl ? (
          <img
            src={tc.screenshotUrl}
            alt="success screenshot"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center text-green-600">
            <div className="text-4xl mb-2">✅</div>
            <div className="font-bold">검증 완료됨</div>
            <div className="text-xs text-gray-500 mt-1">
              이 시나리오가 성공적으로 완료되었습니다.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PendingMediaView() {
  return (
    <div className="flex-1 flex flex-col">
      <h3 className="text-xs font-bold text-gray-600 uppercase mb-3 tracking-wider">
        실행 상태
      </h3>

      <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-lg border border-gray-300">
        <div className="text-center">
          <div className="inline-flex items-center justify-center">
            <div
              className="inline-block"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "3px solid #e5e7eb",
                borderTop: "3px solid #0066cc",
                animation: "spin 1s linear infinite",
              }}
            />
          </div>
          <p className="mt-4 text-sm font-medium text-gray-600">실행 대기 중…</p>
          <p className="text-xs text-gray-400 mt-1">에이전트가 작업을 진행하고 있습니다.</p>
        </div>
      </div>
    </div>
  );
}

// Add CSS keyframe for spinner
if (typeof document !== "undefined") {
  const id = "__debug_panel_keyframes";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(s);
  }
}
