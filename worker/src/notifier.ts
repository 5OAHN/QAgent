import { getApiKeys } from "./api-keys";

export interface RunSummaryForNotify {
  runId: string;
  testName?: string;
  targetUrl?: string;
  passed: number;
  failed: number;
  blocked: number;
  total: number;
  dashboardBaseUrl?: string;
  /** 직전 실행 대비 새로 실패하기 시작한 케이스 — 사람이 진짜 봐야 할 것 */
  newFailures?: { testId: string; scenario: string }[];
  /** 직전 실행에서 실패했다가 이번에 복구된 케이스 수 */
  fixedCount?: number;
  triggeredBySchedule?: boolean;
  /** 설정 오류 등으로 실행 자체가 시작되지 못한 경우의 사유 — 최우선으로 강조해야 함 */
  configError?: string;
}

/**
 * 실행 완료 웹훅 발송 — Slack Incoming Webhook 호환({"text": ...}).
 * 실패해도 파이프라인에 영향을 주지 않는다.
 *
 * 신규 실패(new_failure)가 있으면 그것을 최상단에 강조한다 — 매번 같은 이유로 실패하는
 * 케이스가 있어도 새로 터진 게 없으면 알림 피로도를 낮추기 위해 담백하게 요약만 보낸다.
 */
export async function notifyRunComplete(summary: RunSummaryForNotify): Promise<void> {
  const webhookUrl = (getApiKeys() as any).webhookUrl as string | undefined;
  if (!webhookUrl || !/^https?:\/\//.test(webhookUrl)) return;

  if (summary.configError) {
    const name = summary.testName || summary.targetUrl || "테스트";
    const text = `🚫 QAgent 실행 불가 — ${name}\n${summary.configError}\n예약된 테스트가 계속 실행되지 못하고 있을 수 있습니다. 설정을 확인해주세요.`;
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (err: any) {
      console.warn(`  🔔 설정 오류 알림 발송 실패: ${err.message}`);
    }
    return;
  }

  const hasNewFailures = (summary.newFailures?.length || 0) > 0;
  const allPassed = summary.failed === 0 && summary.blocked === 0 && summary.total > 0;
  const icon = hasNewFailures ? "🆕❌" : allPassed ? "✅" : "❌";
  const name = summary.testName || summary.targetUrl || "테스트";
  const source = summary.triggeredBySchedule ? "예약 실행" : "수동 실행";

  const parts = [`성공 ${summary.passed}`, `실패 ${summary.failed}`];
  if (summary.blocked > 0) parts.push(`보류 ${summary.blocked}`);

  const link = summary.dashboardBaseUrl
    ? `\n${summary.dashboardBaseUrl.replace(/\/$/, "")}/dashboard/${summary.runId}`
    : "";

  const lines = [`${icon} QAgent 테스트 완료 — ${name} (${source})`];

  if (hasNewFailures) {
    lines.push("");
    lines.push(`⚠️ 새로 실패하기 시작한 케이스 ${summary.newFailures!.length}건 — 확인이 필요합니다:`);
    for (const f of summary.newFailures!.slice(0, 5)) {
      lines.push(`  · ${f.testId}: ${f.scenario.replace(/\n/g, " ").slice(0, 60)}`);
    }
    if (summary.newFailures!.length > 5) lines.push(`  · 외 ${summary.newFailures!.length - 5}건`);
  }
  if ((summary.fixedCount || 0) > 0) {
    lines.push(`✅ 이전에 실패했던 ${summary.fixedCount}건이 복구되었습니다.`);
  }

  lines.push("");
  lines.push(`${parts.join(" / ")} (총 ${summary.total}건)${link}`);

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
      signal: AbortSignal.timeout(8000),
    });
    console.log(`  🔔 완료 알림 발송됨`);
  } catch (err: any) {
    console.warn(`  🔔 완료 알림 발송 실패: ${err.message}`);
  }
}
