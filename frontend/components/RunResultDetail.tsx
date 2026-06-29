'use client';

import React, { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface TestCase {
  testId: string;
  scenario: string;
  status: 'Pass' | 'Fail' | 'Pending';
  verificationStatus?: 'approved' | 'rejected' | 'pending';
  consoleLogs?: string[];
  screenshotBase64?: string;
  failReason?: string;
}

interface RunResult {
  runId: string;
  status: 'completed' | 'running' | 'failed';
  total: number;
  passed: number;
  failed: number;
  cases: TestCase[];
  createdAt: string;
  targetUrl?: string;
  loginStatus?: 'success' | 'fail' | 'running';
  loginFailReason?: string;
  loginSteps?: string[];
}

interface RunResultDetailProps {
  run: RunResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function RunResultDetail({ run }: RunResultDetailProps) {
  const [selectedTestId, setSelectedTestId] = useState<string | null>(run.cases[0]?.testId ?? null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pass' | 'fail' | 'review'>('all');

  const selectedCase = run.cases.find(c => c.testId === selectedTestId);

  const filteredCases = run.cases.filter(tc => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pass') return tc.status === 'Pass';
    if (filterStatus === 'fail') return tc.status === 'Fail';
    if (filterStatus === 'review') return tc.verificationStatus === 'pending';
    return true;
  });

  const passCount = run.cases.filter(c => c.status === 'Pass' && c.verificationStatus !== 'rejected').length;
  const failCount = run.cases.filter(c => c.status === 'Fail').length;
  const reviewCount = run.cases.filter(c => c.verificationStatus === 'pending').length;

  const statusColor =
    run.status === 'failed' ? { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' } :
    run.status === 'completed' ? { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' } :
    { bg: '#eff6ff', text: '#2563eb', border: '#93c5fd' };

  const statusLabel = run.status === 'failed' ? '실패' : run.status === 'completed' ? '완료' : '진행 중';

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto grid grid-cols-5 gap-6">

        {/* ──────────────────────────────────────────────────────────────────────────────
            LEFT COLUMN (40%)
            ────────────────────────────────────────────────────────────────────────────── */}
        <div className="col-span-2 space-y-6">

          {/* Execution Summary Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">실행 결과</h2>
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{
                    background: statusColor.bg,
                    color: statusColor.text,
                    border: `1px solid ${statusColor.border}`,
                  }}
                >
                  {statusLabel}
                </span>
              </div>

              <p className="text-xs text-gray-500 mb-4">
                {new Date(run.createdAt).toLocaleString('ko-KR')}
              </p>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: '100%' }} />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-600 mb-1">전체</p>
                  <p className="text-xl font-bold text-gray-900">{run.total}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-600 mb-1">성공</p>
                  <p className="text-xl font-bold text-green-600">{passCount}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-600 mb-1">실패</p>
                  <p className="text-xl font-bold text-red-600">{failCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Login Failure Warning */}
          {run.loginStatus === 'fail' && (
            <LoginFailureWarning reason={run.loginFailReason} steps={run.loginSteps} />
          )}

          {/* Scenario List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">시나리오</h3>

              {/* Status Tabs */}
              <div className="flex gap-2 mb-4 pb-4 border-b border-gray-200">
                {[
                  { key: 'all' as const, label: '전체', count: run.cases.length },
                  { key: 'pass' as const, label: '✅ 완료', count: passCount },
                  { key: 'fail' as const, label: '❌ 실패', count: failCount },
                  { key: 'review' as const, label: '⚠️ 확인필요', count: reviewCount },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setFilterStatus(tab.key)}
                    className={`text-xs font-medium px-3 py-2 rounded-lg transition ${
                      filterStatus === tab.key
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>

              {/* Scenario Cards */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredCases.map(tc => (
                  <ScenarioCard
                    key={tc.testId}
                    tc={tc}
                    isSelected={tc.testId === selectedTestId}
                    onClick={() => setSelectedTestId(tc.testId)}
                  />
                ))}
              </div>
            </div>

            {/* Retry Button */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition">
                시나리오 수정 후 재시도
              </button>
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────────────────────────
            RIGHT COLUMN (60%)
            ────────────────────────────────────────────────────────────────────────────── */}
        <div className="col-span-3 space-y-6">

          {/* Media Viewer */}
          {selectedCase && (
            <MediaViewer tc={selectedCase} />
          )}

          {/* Timeline */}
          {selectedCase && (
            <TimelineCard tc={selectedCase} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function LoginFailureWarning({
  reason,
  steps,
}: {
  reason?: string;
  steps?: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border-2 border-red-300 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-red-50 transition"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm6-14V9m0-4V5a2 2 0 00-2-2h-.5a2 2 0 00-2 2v4m0 0a2 2 0 104 0m-4 0a2 2 0 11-4 0" />
          </svg>
          <span className="font-semibold text-red-600">로그인 실패</span>
        </div>
        <svg
          className={`w-5 h-5 text-red-600 transition ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-6 py-4 bg-red-50 border-t border-red-200">
          <p className="text-sm text-red-700 mb-3">
            <strong>사유:</strong> {reason || '알 수 없음'}
          </p>
          {steps && steps.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-red-600 font-medium mb-2">로그인 단계:</p>
              {steps.map((step, i) => (
                <p key={i} className="text-xs text-red-600">{step}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScenarioCard({
  tc,
  isSelected,
  onClick,
}: {
  tc: TestCase;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusIcon =
    tc.status === 'Pass' ? (
      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ) : tc.status === 'Fail' ? (
      <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ) : (
      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border-2 cursor-pointer transition ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-3 mb-2">
        {statusIcon}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-semibold text-gray-900">{tc.testId}</p>
          {tc.verificationStatus === 'pending' && (
            <span className="inline-block mt-1 text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded">
              확인 필요
            </span>
          )}
        </div>
      </div>

      <p className={`text-sm text-gray-700 ${!isExpanded ? 'line-clamp-2' : ''}`}>
        {tc.scenario}
      </p>

      {tc.scenario.split('\n').length > 2 && (
        <button
          onClick={e => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          {isExpanded ? '접기 ∧' : '전체 보기 ∨'}
        </button>
      )}
    </div>
  );
}

function MediaViewer({ tc }: { tc: TestCase }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-6">
      {tc.screenshotBase64 ? (
        <div className="relative">
          <img
            src={`data:image/png;base64,${tc.screenshotBase64}`}
            alt="screenshot"
            className="w-full h-96 object-contain rounded-lg"
          />
          {tc.status === 'Fail' && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-20 border-4 border-red-500 rounded pointer-events-none" />
          )}
        </div>
      ) : (
        <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
          스크린샷 없음
        </div>
      )}
    </div>
  );
}

function TimelineCard({ tc }: { tc: TestCase }) {
  const logs = tc.consoleLogs ?? [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">실행 타임라인</h3>

        {/* Failure Reason */}
        {tc.status === 'Fail' && tc.failReason && (
          <div className="mb-4 p-3 border-2 border-red-300 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700">
              <strong>실패 사유:</strong> {tc.failReason}
            </p>
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {logs.map((log, i) => (
            <TimelineItem key={i} log={log} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ log }: { log: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5" />
      </div>
      <div className="flex-1">
        <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700">
          {log}
        </div>
      </div>
    </div>
  );
}
