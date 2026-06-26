import { NextResponse } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8001";
const WORKER_API_KEY = process.env.WORKER_API_KEY || "";

export async function GET() {
  try {
    const res = await fetch(`${WORKER_URL}/runs`, { cache: "no-store", headers: { "x-qagent-key": WORKER_API_KEY } });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
