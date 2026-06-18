import { RunDashboard } from "@/components/RunDashboard";

export default function DashboardPage({ params }: { params: { runId: string } }) {
  return <RunDashboard runId={params.runId} />;
}
