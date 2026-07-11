"use client";

import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAdminToken, setAdminToken, clearAdminToken } from "@/lib/admin";
import AdminAuthModal from "@/components/AdminAuthModal";
import { IconFlask, IconClock } from "@/components/icons";

interface ScheduleConfig {
  frequency: "off" | "hourly" | "daily" | "weekdays";
  hour?: number;
}

interface SavedTest {
  id: string;
  name: string;
  targetUrl: string;
  scenarios: string[];
  loginConfig?: { fields: { label: string; value: string; isPassword: boolean }[] };
  createdAt: string;
  updatedAt: string;
  schedule?: ScheduleConfig;
  lastRun?: {
    runId: string;
    status: "running" | "completed" | "failed";
    passed: number;
    failed: number;
    total: number;
    at: string;
    triggeredBy?: "manual" | "schedule";
  };
}

const SCHEDULE_OPTIONS: { value: ScheduleConfig["frequency"]; label: string }[] = [
  { value: "off", label: "예약 안 함" },
  { value: "hourly", label: "매시간" },
  { value: "daily", label: "매일" },
  { value: "weekdays", label: "평일마다" },
];

function scheduleLabel(s?: ScheduleConfig): string {
  if (!s || s.frequency === "off") return "예약 없음";
  if (s.frequency === "hourly") return "매시간 자동 실행";
  const hour = s.hour ?? 9;
  const timeLabel = `${String(hour).padStart(2, "0")}:00`;
  return s.frequency === "daily" ? `매일 ${timeLabel} 자동 실행` : `평일 ${timeLabel} 자동 실행`;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const A = {
  blue: "#0066cc", blueDark: "#0055b3", ink: "#1d1d1f", inkMuted: "#6b7280",
  hairline: "#e0e0e0", divider: "#f0f0f0", canvas: "#ffffff", parchment: "#f5f5f7",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

export default function TestsPage() {
  const router = useRouter();
  const { data: tests, mutate } = useSWR<SavedTest[]>("/api/tests", fetcher, { refreshInterval: 5000 });
  const [runningId, setRunningId] = useState<string | null>(null);
  // 인증이 필요한 액션(실행 또는 예약 설정)을 인증 후 재시도하기 위해 보류 중인 액션을 기억
  const [pendingAuthAction, setPendingAuthAction] = useState<{ type: "run" | "schedule"; testId: string; schedule?: ScheduleConfig } | null>(null);
  const [error, setError] = useState("");
  const [scheduleOpenFor, setScheduleOpenFor] = useState<string | null>(null);

  const updateSchedule = async (testId: string, schedule: ScheduleConfig, token?: string) => {
    const res = await fetch(`/api/tests/${testId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-qagent-admin-token": token ?? getAdminToken() },
      body: JSON.stringify({ schedule }),
    });
    if (res.status === 403) {
      clearAdminToken();
      setPendingAuthAction({ type: "schedule", testId, schedule });
      return;
    }
    mutate();
  };

  const runTest = async (testId: string, token?: string) => {
    setRunningId(testId);
    setError("");
    try {
      const res = await fetch(`/api/tests/${testId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-qagent-admin-token": token ?? getAdminToken() },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.status === 403) {
        clearAdminToken();
        setPendingAuthAction({ type: "run", testId });
        return;
      }
      if (data.run_id) {
        router.push(`/dashboard/${data.run_id}`);
      } else {
        setError(data.error || "실행에 실패했습니다.");
      }
    } catch {
      setError("Worker에 연결할 수 없습니다.");
    } finally {
      setRunningId(null);
    }
  };

  const deleteTest = async (testId: string, name: string) => {
    if (!confirm(`"${name}" 테스트를 삭제할까요? 실행 이력은 유지됩니다.`)) return;
    await fetch(`/api/tests/${testId}`, { method: "DELETE" });
    mutate();
  };

  const isEmpty = tests && tests.length === 0;

  return (
    <>
      <header style={{ background: A.canvas, borderBottom: `1px solid ${A.divider}`, padding: "0 28px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: A.inkMuted, fontWeight: 500 }}>QAgent</span>
          <span style={{ fontSize: 12, color: A.hairline }}>/</span>
          <span style={{ fontSize: 12, color: A.blue, fontWeight: 600 }}>내 테스트</span>
        </div>
        <button
          onClick={() => router.push("/new")}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: A.blue, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = A.blueDark)}
          onMouseLeave={(e) => (e.currentTarget.style.background = A.blue)}
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
          테스트 만들기
        </button>
      </header>

      <main style={{ flex: 1, overflowY: "auto", padding: "28px 28px 48px", background: A.parchment }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: A.ink, marginBottom: 4 }}>내 테스트</h1>
            <p style={{ fontSize: 13, color: A.inkMuted }}>저장된 테스트를 클릭 한 번으로 반복 실행하세요. 회귀 테스트의 기본입니다.</p>
          </div>

          {error && (
            <div style={{ borderRadius: 10, background: "#fff5f5", border: "1px solid #fecaca", padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>{error}</div>
          )}

          {!tests ? (
            <p style={{ fontSize: 13, color: A.inkMuted, padding: 20 }}>불러오는 중…</p>
          ) : isEmpty ? (
            <div style={{ background: A.canvas, borderRadius: 14, border: `1px dashed ${A.hairline}`, padding: "48px 24px", textAlign: "center" }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, margin: "0 auto 14px",
                background: "rgba(0,102,204,0.08)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <IconFlask size={24} color={A.blue} strokeWidth={1.6} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: A.ink, marginBottom: 6 }}>아직 저장된 테스트가 없습니다</p>
              <p style={{ fontSize: 13, color: A.inkMuted, marginBottom: 18 }}>테스트를 만들어두면 언제든 클릭 한 번으로 다시 실행할 수 있습니다.</p>
              <button
                onClick={() => router.push("/new")}
                style={{ padding: "10px 20px", borderRadius: 10, background: A.blue, color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                첫 테스트 만들기
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tests.map((t) => {
                const lr = t.lastRun;
                const badge = !lr
                  ? { label: "미실행", bg: A.divider, color: A.inkMuted }
                  : lr.status === "running"
                  ? { label: "실행 중", bg: "rgba(99,102,241,0.1)", color: "#6366f1" }
                  : lr.failed === 0
                  ? { label: `성공 ${lr.passed}/${lr.total}`, bg: "rgba(22,163,74,0.08)", color: "#16a34a" }
                  : { label: `실패 ${lr.failed}/${lr.total}`, bg: "rgba(220,38,38,0.08)", color: "#dc2626" };

                return (
                  <div key={t.id} style={{ background: A.canvas, borderRadius: 12, border: `1px solid ${A.hairline}`, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                      style={{ flex: 1, minWidth: 0, cursor: lr ? "pointer" : "default" }}
                      onClick={() => lr && router.push(`/dashboard/${lr.runId}`)}
                      title={lr ? "마지막 실행 결과 보기" : undefined}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <p style={{ fontSize: 15, fontWeight: 600, color: A.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</p>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: badge.bg, color: badge.color, flexShrink: 0 }}>{badge.label}</span>
                      </div>
                      <p style={{ fontSize: 12, color: A.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.targetUrl.replace(/^https?:\/\//, "")} · 시나리오 {t.scenarios.length}개
                        {t.loginConfig?.fields?.some((f) => f.value) ? " · 로그인 설정됨" : ""}
                        {lr ? ` · 마지막 실행 ${timeAgo(lr.at)}${lr.triggeredBy === "schedule" ? " (예약)" : ""}` : ""}
                      </p>
                    </div>

                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setScheduleOpenFor(scheduleOpenFor === t.id ? null : t.id); }}
                        title="자동 실행 예약"
                        style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8,
                          background: t.schedule && t.schedule.frequency !== "off" ? "rgba(0,102,204,0.08)" : "transparent",
                          border: `1px solid ${t.schedule && t.schedule.frequency !== "off" ? "rgba(0,102,204,0.25)" : A.hairline}`,
                          color: t.schedule && t.schedule.frequency !== "off" ? A.blue : A.inkMuted,
                          fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                        }}
                      >
                        <IconClock size={13} />
                        {t.schedule && t.schedule.frequency !== "off" ? scheduleLabel(t.schedule) : "예약"}
                      </button>

                      {scheduleOpenFor === t.id && (
                        <SchedulePopover
                          schedule={t.schedule}
                          onChange={(s) => { updateSchedule(t.id, s); setScheduleOpenFor(null); }}
                          onClose={() => setScheduleOpenFor(null)}
                        />
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => runTest(t.id)}
                        disabled={runningId === t.id || lr?.status === "running"}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8,
                          background: runningId === t.id || lr?.status === "running" ? A.divider : A.blue,
                          color: runningId === t.id || lr?.status === "running" ? A.inkMuted : "#fff",
                          border: "none", fontSize: 13, fontWeight: 600,
                          cursor: runningId === t.id || lr?.status === "running" ? "not-allowed" : "pointer",
                        }}
                      >
                        {runningId === t.id ? (
                          "시작 중…"
                        ) : lr?.status === "running" ? (
                          "실행 중"
                        ) : (
                          <>
                            <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            실행
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => router.push(`/new?edit=${t.id}`)}
                        title="수정"
                        style={{ padding: "8px 10px", borderRadius: 8, background: "transparent", border: `1px solid ${A.hairline}`, color: A.inkMuted, fontSize: 13, cursor: "pointer" }}
                      >
                        수정
                      </button>
                      <button
                        onClick={() => deleteTest(t.id, t.name)}
                        title="삭제"
                        style={{ padding: "8px 10px", borderRadius: 8, background: "transparent", border: `1px solid ${A.hairline}`, color: A.inkMuted, fontSize: 13, cursor: "pointer" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.borderColor = "#fecaca"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = A.inkMuted; e.currentTarget.style.borderColor = A.hairline; }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {pendingAuthAction && (
        <AdminAuthModal
          onClose={() => setPendingAuthAction(null)}
          onVerified={(token) => {
            setAdminToken(token);
            const action = pendingAuthAction;
            setPendingAuthAction(null);
            if (action.type === "run") runTest(action.testId, token);
            else updateSchedule(action.testId, action.schedule!, token);
          }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 자동 실행 예약 팝오버 — 여기서 설정해두면 사람이 버튼을 안 눌러도 정해진 시각에 실행됨
// ─────────────────────────────────────────────────────────────────────────────

function SchedulePopover({
  schedule,
  onChange,
  onClose,
}: {
  schedule?: ScheduleConfig;
  onChange: (s: ScheduleConfig) => void;
  onClose: () => void;
}) {
  const [frequency, setFrequency] = useState<ScheduleConfig["frequency"]>(schedule?.frequency || "off");
  const [hour, setHour] = useState<number>(schedule?.hour ?? 9);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
          width: 240, background: A.canvas, borderRadius: 12, border: `1px solid ${A.hairline}`,
          boxShadow: "0 12px 32px rgba(0,0,0,0.12)", padding: 14,
        }}
      >
        <p style={{ fontSize: 12, fontWeight: 700, color: A.ink, marginBottom: 10 }}>자동 실행 예약</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: frequency === "off" || frequency === "hourly" ? 0 : 10 }}>
          {SCHEDULE_OPTIONS.map((opt) => (
            <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: A.ink, cursor: "pointer" }}>
              <input
                type="radio" name="freq" checked={frequency === opt.value}
                onChange={() => setFrequency(opt.value)}
                style={{ accentColor: A.blue }}
              />
              {opt.label}
            </label>
          ))}
        </div>

        {(frequency === "daily" || frequency === "weekdays") && (
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: A.inkMuted, display: "block", marginBottom: 4 }}>실행 시각</label>
            <select
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: `1px solid ${A.hairline}`, fontSize: 13 }}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
              ))}
            </select>
          </div>
        )}

        <p style={{ fontSize: 10.5, color: A.inkMuted, lineHeight: 1.5, marginBottom: 10 }}>
          예약 실행은 관리자 인증 없이 자동으로 진행되며, 완료되면 설정된 알림(Slack 등)으로 결과를 받습니다.
        </p>

        <button
          onClick={() => onChange({ frequency, hour })}
          style={{ width: "100%", padding: "8px 0", borderRadius: 8, background: A.blue, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          저장
        </button>
      </div>
    </>
  );
}
