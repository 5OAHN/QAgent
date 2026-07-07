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
}

/**
 * 실행 완료 웹훅 발송 — Slack Incoming Webhook 호환({"text": ...}).
 * 실패해도 파이프라인에 영향을 주지 않는다.
 */
export async function notifyRunComplete(summary: RunSummaryForNotify): Promise<void> {
  const webhookUrl = (getApiKeys() as any).webhookUrl as string | undefined;
  if (!webhookUrl || !/^https?:\/\//.test(webhookUrl)) return;

  const allPassed = summary.failed === 0 && summary.blocked === 0 && summary.total > 0;
  const icon = allPassed ? "✅" : "❌";
  const name = summary.testName || summary.targetUrl || "테스트";
  const parts = [`성공 ${summary.passed}`, `실패 ${summary.failed}`];
  if (summary.blocked > 0) parts.push(`보류 ${summary.blocked}`);

  const link = summary.dashboardBaseUrl
    ? `\n${summary.dashboardBaseUrl.replace(/\/$/, "")}/dashboard/${summary.runId}`
    : "";

  const text = `${icon} QAgent 테스트 완료 — ${name}\n${parts.join(" / ")} (총 ${summary.total}건)${link}`;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(8000),
    });
    console.log(`  🔔 완료 알림 발송됨`);
  } catch (err: any) {
    console.warn(`  🔔 완료 알림 발송 실패: ${err.message}`);
  }
}
