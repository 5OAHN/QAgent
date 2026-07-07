import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8001";
const WORKER_API_KEY = process.env.WORKER_API_KEY || "";

export async function POST(req: NextRequest) {
  const { password } = (await req.json()) as { password?: string };
  if (!password) return NextResponse.json({ error: "비밀번호를 입력하세요." }, { status: 400 });

  try {
    const res = await fetch(`${WORKER_URL}/auth/verify-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-qagent-key": WORKER_API_KEY },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: data.error || "인증에 실패했습니다." }, { status: res.status });
    }
    return NextResponse.json({ ok: true, adminToken: data.adminToken || "" });
  } catch {
    return NextResponse.json({ error: "Worker에 연결할 수 없습니다." }, { status: 503 });
  }
}
