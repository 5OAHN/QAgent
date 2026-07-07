import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8001";
const WORKER_API_KEY = process.env.WORKER_API_KEY || "";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    body.dashboardBaseUrl = body.dashboardBaseUrl || req.nextUrl.origin;
    const adminToken = req.headers.get("x-qagent-admin-token") || "";
    const res = await fetch(`${WORKER_URL}/tests/${params.id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-qagent-key": WORKER_API_KEY, "x-qagent-admin-token": adminToken },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: "Worker에 연결할 수 없습니다." }, { status: 503 });
  }
}
