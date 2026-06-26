import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8001";
const WORKER_API_KEY = process.env.WORKER_API_KEY || "";

export async function POST(req: NextRequest) {
  const { currentPassword, newPassword } = await req.json() as { currentPassword?: string; newPassword?: string };

  try {
    const res = await fetch(`${WORKER_URL}/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-qagent-key": WORKER_API_KEY },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: "Worker에 연결할 수 없습니다." }, { status: 503 });
  }
}
