import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8001";
const WORKER_API_KEY = process.env.WORKER_API_KEY || "";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const res = await fetch(`${WORKER_URL}/run/${params.runId}`, { method: "DELETE", headers: { "x-qagent-key": WORKER_API_KEY } });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: "Worker에 연결할 수 없습니다." }, { status: 503 });
  }
}
