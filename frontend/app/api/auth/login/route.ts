import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, signSession } from "@/lib/session";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8001";
const WORKER_API_KEY = process.env.WORKER_API_KEY || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";

export async function POST(req: NextRequest) {
  const { password } = await req.json() as { password?: string };
  if (!password) return NextResponse.json({ error: "비밀번호를 입력하세요." }, { status: 400 });

  try {
    const res = await fetch(`${WORKER_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-qagent-key": WORKER_API_KEY },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ error: data.error || "로그인에 실패했습니다." }, { status: res.status });
    }

    const token = await signSession(SESSION_SECRET);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Worker에 연결할 수 없습니다." }, { status: 503 });
  }
}
