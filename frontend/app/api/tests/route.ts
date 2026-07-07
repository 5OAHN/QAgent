import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8001";
const WORKER_API_KEY = process.env.WORKER_API_KEY || "";

const headers = () => ({ "Content-Type": "application/json", "x-qagent-key": WORKER_API_KEY });

export async function GET() {
  try {
    const res = await fetch(`${WORKER_URL}/tests`, { headers: headers(), cache: "no-store" });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: "Worker에 연결할 수 없습니다." }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${WORKER_URL}/tests`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: "Worker에 연결할 수 없습니다." }, { status: 503 });
  }
}
