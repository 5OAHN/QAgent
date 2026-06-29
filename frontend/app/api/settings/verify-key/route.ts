import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8001";
const WORKER_API_KEY = process.env.WORKER_API_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${WORKER_URL}/settings/verify-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-qagent-key": WORKER_API_KEY },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, error: "Worker에 연결할 수 없습니다." }, { status: 503 });
  }
}
