import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8001";

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  try {
    // 자연어 모드: JSON body
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const res = await fetch(`${WORKER_URL}/trigger/natural`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return NextResponse.json(await res.json(), { status: res.status });
    }

    // 엑셀 모드: multipart/form-data 그대로 전달
    const formData = await req.formData();
    const file = formData.get("excel") as File | null;
    if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });

    const workerForm = new FormData();
    workerForm.append("excel", file, file.name);
    const url = formData.get("url");
    if (url) workerForm.append("url", url as string);
    const executor = formData.get("executor");
    if (executor) workerForm.append("executor", executor as string);

    const res = await fetch(`${WORKER_URL}/trigger/excel`, {
      method: "POST",
      body: workerForm,
    });
    return NextResponse.json(await res.json(), { status: res.status });

  } catch {
    return NextResponse.json({ error: "Worker에 연결할 수 없습니다." }, { status: 503 });
  }
}
