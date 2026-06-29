"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import FilterDropdown, { FilterOption } from "@/components/FilterDropdown";

interface RunSummary {
  runId: string;
  status: "running" | "completed" | "failed";
  total: number;
  passed: number;
  failed: number;
  createdAt: string;
  mode: "excel" | "natural";
  targetUrl?: string;
  executor?: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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

type StatusFilter = "completed" | "failIncluded" | "running";
type PeriodFilter = "today" | "7d" | "30d";
type ModeFilter = "natural" | "excel";

const STATUS_OPTIONS: FilterOption[] = [
  { key: "completed", label: "완료" },
  { key: "failIncluded", label: "Fail 포함" },
  { key: "running", label: "진행 중" },
];
const PERIOD_OPTIONS: FilterOption[] = [
  { key: "today", label: "오늘" },
  { key: "7d", label: "7일" },
  { key: "30d", label: "30일" },
];
const MODE_OPTIONS: FilterOption[] = [
  { key: "natural", label: "자연어" },
  { key: "excel", label: "엑셀" },
];

function filterRuns(runs: RunSummary[], selectedStatuses: string[], selectedPeriods: string[], selectedModes: string[]): RunSummary[] {
  let result = runs;

  // 상태 필터
  if (selectedStatuses.length > 0) {
    result = result.filter((r) => {
      for (const status of selectedStatuses) {
        if (status === "completed" && r.status === "completed") return true;
        if (status === "failIncluded" && r.failed > 0) return true;
        if (status === "running" && r.status === "running") return true;
      }
      return false;
    });
  }

  // 모드 필터
  if (selectedModes.length > 0) {
    result = result.filter((r) => selectedModes.includes(r.mode));
  }

  // 기간 필터
  if (selectedPeriods.length > 0) {
    const ranges: Record<string, number> = {
      today: 1000 * 60 * 60 * 24,
      "7d": 1000 * 60 * 60 * 24 * 7,
      "30d": 1000 * 60 * 60 * 24 * 30,
    };
    const now = Date.now();
    result = result.filter((r) => {
      const createdTime = new Date(r.createdAt).getTime();
      for (const period of selectedPeriods) {
        const cutoff = now - (ranges[period] || 0);
        if (createdTime >= cutoff) return true;
      }
      return false;
    });
  }

  return result;
}

export default function HistoryPage() {
  return <Suspense><HistoryPageInner /></Suspense>;
}

function HistoryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [selectedModes, setSelectedModes] = useState<string[]>([]);
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(new Set());

  // 대시보드 통계 카드에서 ?status=... 로 진입한 경우 초기 필터 반영
  useEffect(() => {
    const s = searchParams.get("status");
    if (s === "completed" || s === "failIncluded" || s === "running") {
      setSelectedStatuses([s]);
    }
  }, []);

  const { data: runs = [], isLoading, mutate } = useSWR<RunSummary[]>(
    "/api/history",
    fetcher,
    { refreshInterval: 5000 }
  );

  const filteredRuns = filterRuns(runs, selectedStatuses, selectedPeriods, selectedModes);

  const handleDelete = async (runId: string) => {
    if (!confirm("이 테스트 이력을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    mutate((prev) => (prev ?? []).filter((r) => r.runId !== runId), { revalidate: false });
    try {
      const res = await fetch(`/api/run/${runId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "삭제에 실패했습니다.");
        mutate();
      }
    } catch {
      alert("Worker에 연결할 수 없습니다.");
      mutate();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRunIds.size === 0) return;
    if (!confirm(`${selectedRunIds.size}개의 테스트 이력을 삭제하시겠습니까? 되돌릴 수 없습니다.`)) return;

    const selectedIds = Array.from(selectedRunIds);
    mutate((prev) => (prev ?? []).filter((r) => !selectedIds.includes(r.runId)), { revalidate: false });

    try {
      const failedIds = [];
      for (const id of selectedIds) {
        const res = await fetch(`/api/run/${id}`, { method: "DELETE" });
        if (!res.ok) failedIds.push(id);
      }
      if (failedIds.length > 0) {
        alert(`${failedIds.length}개 항목 삭제 실패. 다시 시도해주세요.`);
        mutate();
      } else {
        setSelectedRunIds(new Set());
      }
    } catch {
      alert("Worker에 연결할 수 없습니다.");
      mutate();
    }
  };

  const toggleRunSelection = (runId: string) => {
    const newSelected = new Set(selectedRunIds);
    if (newSelected.has(runId)) {
      newSelected.delete(runId);
    } else {
      newSelected.add(runId);
    }
    setSelectedRunIds(newSelected);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* 헤더 */}
      <header style={{
        background: A.canvas,
        borderBottom: `1px solid ${A.divider}`,
        padding: "0 28px",
        height: 54,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: A.inkMuted, fontWeight: 500 }}>QAgent</span>
          <span style={{ fontSize: 12, color: A.hairline }}>/</span>
          <span style={{ fontSize: 12, color: A.blue, fontWeight: 600 }}>테스트 이력</span>
        </div>
        <div />
      </header>

      {/* 메인 */}
      <main style={{ flex: 1, padding: "28px", overflowY: "auto", background: A.parchment }}>
        {isLoading ? (
          <LoadingState />
        ) : runs.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* 드롭다운 필터 */}
            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
              {/* 상태 필터 */}
              <FilterDropdown
                label="상태"
                icon={
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="9" cy="11" r="7" />
                    <path d="M20 20l-4-4" strokeLinecap="round" />
                  </svg>
                }
                options={STATUS_OPTIONS}
                selectedValues={selectedStatuses}
                onSelectionChange={setSelectedStatuses}
              />

              {/* 기간 필터 */}
              <FilterDropdown
                label="기간"
                icon={
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M3 10h18M9 1v6M15 1v6" strokeLinecap="round" />
                  </svg>
                }
                options={PERIOD_OPTIONS}
                selectedValues={selectedPeriods}
                onSelectionChange={setSelectedPeriods}
              />

              {/* 모드 필터 */}
              <FilterDropdown
                label="모드"
                icon={
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5M14 4h6M14 4v6M14 4l8 8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
                options={MODE_OPTIONS}
                selectedValues={selectedModes}
                onSelectionChange={setSelectedModes}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: A.ink, letterSpacing: "0.04em", textTransform: "uppercase" }}>전체 실행 이력</h2>
                <span style={{ fontSize: 12, color: A.inkMuted }}>
                  {selectedRunIds.size > 0 ? `${selectedRunIds.size}개 선택` : `${filteredRuns.length}개 항목`}
                </span>
              </div>
              {selectedRunIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  style={{
                    padding: "6px 14px",
                    background: "#dc2626",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#b91c1c"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#dc2626"; }}
                >
                  선택 삭제
                </button>
              )}
            </div>

            {filteredRuns.length === 0 ? (
              <div style={{ ...card, padding: "40px 0", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: A.inkMuted }}>선택한 조건에 해당하는 이력이 없습니다.</p>
              </div>
            ) : (
              <>
                <div style={{ ...card, overflow: "hidden" }}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "36px 130px 1fr 110px 100px 130px 90px 40px",
                    padding: "11px 22px",
                    background: A.parchment,
                    borderBottom: `1px solid ${A.hairline}`,
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedRunIds.size > 0 && selectedRunIds.size === filteredRuns.length}
                      onChange={() => {
                        if (selectedRunIds.size === filteredRuns.length) {
                          setSelectedRunIds(new Set());
                        } else {
                          setSelectedRunIds(new Set(filteredRuns.map((r) => r.runId)));
                        }
                      }}
                      style={{ width: 16, height: 16, cursor: "pointer", accentColor: A.blue }}
                    />
                    {["상태", "프로젝트 (URL)", "실행자", "결과 요약", "실행 일시", "모드", ""].map((h, i) => (
                      <span key={i} style={{ fontSize: 11, fontWeight: 600, color: A.inkMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</span>
                    ))}
                  </div>
                  {filteredRuns.map((run, i) => (
                    <HistoryRow
                      key={run.runId}
                      run={run}
                      isLast={i === filteredRuns.length - 1}
                      isSelected={selectedRunIds.has(run.runId)}
                      onToggleSelect={() => toggleRunSelection(run.runId)}
                      onClick={() => router.push(`/dashboard/${run.runId}`)}
                      onDelete={() => handleDelete(run.runId)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function HistoryRow({ run, isLast, isSelected, onToggleSelect, onClick, onDelete }: { run: RunSummary; isLast: boolean; isSelected: boolean; onToggleSelect: () => void; onClick: () => void; onDelete: () => void }) {
  const passRate = run.total > 0 ? `${run.passed}/${run.total}` : "—";
  const allPass  = run.passed === run.total && run.total > 0;
  const hasFail  = run.failed > 0;

  const badge = (() => {
    if (run.status === "running") return { label: "실행 중",   bg: "#eff6ff", color: "#0066cc", border: "#bfdbfe", dot: true };
    if (hasFail)                  return { label: "Fail 포함", bg: "#fef2f2", color: "#dc2626", border: "#fecaca", dot: false };
    if (run.status === "failed")  return { label: "오류",      bg: "#fef2f2", color: "#dc2626", border: "#fecaca", dot: false };
    return                               { label: "Pass",      bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", dot: false };
  })();

  const hostname = (() => {
    try { return new URL(run.targetUrl || "").hostname; } catch { return run.targetUrl || "—"; }
  })();

  return (
    <div
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "36px 130px 1fr 110px 100px 130px 90px 40px",
        padding: "14px 22px",
        alignItems: "center",
        borderBottom: isLast ? "none" : `1px solid ${A.divider}`,
        cursor: "pointer",
        transition: "background .12s",
        background: isSelected ? "rgba(0, 102, 204, 0.05)" : "transparent",
      }}
      onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = A.parchment)}
      onMouseLeave={(e) => (e.currentTarget.style.background = isSelected ? "rgba(0, 102, 204, 0.05)" : "transparent")}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          style={{ width: 16, height: 16, cursor: "pointer", accentColor: A.blue }}
        />
      </div>
      <div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99,
          background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
        }}>
          {badge.dot && (
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: badge.color, animation: "pulse 1.4s ease-in-out infinite", display: "inline-block" }} />
          )}
          {badge.label}
        </span>
      </div>

      <div style={{ minWidth: 0, paddingRight: 16 }}>
        <p style={{ fontSize: 13, color: A.ink, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hostname}</p>
        {run.targetUrl && (
          <p style={{ fontSize: 11, color: A.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{run.targetUrl}</p>
        )}
      </div>

      <div>
        {run.executor
          ? <span style={{ fontSize: 12, color: A.ink, background: A.parchment, padding: "2px 8px", borderRadius: 6, border: `1px solid ${A.hairline}` }}>{run.executor}</span>
          : <span style={{ fontSize: 12, color: A.inkMuted }}>—</span>}
      </div>

      <div>
        <span style={{ fontSize: 14, fontWeight: 700, color: hasFail ? "#dc2626" : allPass ? "#16a34a" : A.inkMuted }}>{passRate}</span>
        {run.total > 0 && <span style={{ fontSize: 11, color: A.inkMuted, marginLeft: 4 }}>Pass</span>}
      </div>

      <div>
        <p style={{ fontSize: 12, color: A.ink, fontWeight: 500 }}>
          {new Date(run.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
        </p>
        <p style={{ fontSize: 11, color: A.inkMuted, marginTop: 2 }}>
          {new Date(run.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      <div>
        <span style={{
          fontSize: 11, color: A.blue, background: "rgba(0,102,204,0.07)",
          padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(0,102,204,0.15)", fontWeight: 500,
        }}>
          {run.mode === "natural" ? "자연어" : "엑셀"}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {run.status !== "running" && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="삭제"
            style={{ background: "none", border: "none", cursor: "pointer", color: A.hairline, padding: 4, borderRadius: 6 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = A.hairline; e.currentTarget.style.background = "transparent"; }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 6v4M8.5 6v4M3 3.5l.7 7.2a.5.5 0 00.5.3h5.6a.5.5 0 00.5-.3L11 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${A.hairline}`, borderTopColor: A.blue, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ fontSize: 13, color: A.inkMuted }}>이력을 불러오는 중…</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "56px 0 40px", textAlign: "center" }}>

      <div style={{
        width: 80, height: 80, borderRadius: 20,
        background: "rgba(0,102,204,0.06)",
        border: "1px solid rgba(0,102,204,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 24,
      }}>
        <svg width="36" height="36" fill="none" stroke={A.blue} strokeWidth="1.5" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7"/>
          <path d="M16.5 16.5L21 21" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 11h6M11 8v6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 600, color: A.ink, letterSpacing: "-0.5px", marginBottom: 10 }}>
        아직 실행된 테스트 이력이 없습니다.
      </h2>
      <p style={{ fontSize: 14, color: A.inkMuted, lineHeight: 1.7, marginBottom: 28, maxWidth: 360 }}>
        첫 번째 QA 시나리오를 작성하고<br />
        자동화 파이프라인을 구축해 보세요.
      </p>

      <Link
        href="/new"
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "11px 24px", borderRadius: 9999,
          background: A.blue,
          color: "#fff", fontSize: 14, fontWeight: 600,
          textDecoration: "none", letterSpacing: "-0.2px",
          transition: "background .15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#0055b3"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = A.blue; }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        첫 테스트 생성하기
      </Link>

      {/* 템플릿 빠른 시작 */}
      <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%", maxWidth: 480 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: A.inkMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          템플릿으로 빠르게 시작
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
          {TEMPLATES.map(({ label, icon, scenario }) => (
            <Link
              key={label}
              href={`/new?scenarios=${encodeURIComponent(scenario)}`}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", borderRadius: 10,
                background: A.canvas, border: `1px solid ${A.hairline}`,
                textDecoration: "none", cursor: "pointer",
                transition: "border-color .12s, background .12s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = A.blue; e.currentTarget.style.background = "rgba(0,102,204,0.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = A.hairline; e.currentTarget.style.background = A.canvas; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: A.ink }}>{label}</span>
              </div>
              <svg width="14" height="14" fill="none" stroke={A.blue} strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

const TEMPLATES = [
  {
    label: "로그인 플로우 테스트",
    icon: "🔐",
    scenario: `1. 로그인 페이지로 이동한다
2. 아이디 입력칸에 테스트 계정을 입력한다
3. 비밀번호 입력칸에 비밀번호를 입력한다
4. 로그인 버튼을 클릭한다
5. 로그인 후 메인 화면이 표시되는지 확인한다`,
  },
  {
    label: "회원가입 시나리오",
    icon: "✍️",
    scenario: `1. 회원가입 페이지로 이동한다
2. 이름, 이메일, 비밀번호를 입력한다
3. 이용약관 동의 체크박스를 클릭한다
4. 가입하기 버튼을 클릭한다
5. 가입 완료 메시지 또는 이메일 인증 안내가 표시되는지 확인한다`,
  },
  {
    label: "결제 프로세스 검증",
    icon: "💳",
    scenario: `1. 상품 목록 페이지로 이동한다
2. 상품을 하나 선택하여 장바구니에 추가한다
3. 장바구니 페이지로 이동한다
4. 결제하기 버튼을 클릭한다
5. 결제 정보 입력 화면이 표시되는지 확인한다`,
  },
];
