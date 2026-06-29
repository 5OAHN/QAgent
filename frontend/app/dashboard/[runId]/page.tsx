import { RunResultDashboard } from "@/components/RunResultDashboard";

export default function DashboardPage({ params }: { params: { runId: string } }) {
  return <RunResultDashboard runId={params.runId} />;
}
