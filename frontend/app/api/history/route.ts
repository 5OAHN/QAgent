import { NextResponse } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8001";
const WORKER_API_KEY = process.env.WORKER_API_KEY || "";

export async function GET() {
  try {
    const res = await fetch(`${WORKER_URL}/runs`, {
      cache: "no-store",
      headers: { "x-qagent-key": WORKER_API_KEY },
      signal: AbortSignal.timeout(15000), // Worker가 응답 없을 때 무한 로딩 방지
    });
    const body = await res.json();
    // 워커가 살아있어도 배열이 아닌 에러 바디를 200 이외 상태로 줄 수 있다(인증 실패, 플랫폼 레벨 에러 등).
    // 프론트는 이 응답을 항상 배열로 가정하므로, 계약을 지키기 위해 실패 시 빈 배열로 대체한다.
    if (!res.ok || !Array.isArray(body)) {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json(body, { status: 200 });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
