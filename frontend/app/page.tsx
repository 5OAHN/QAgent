"use client";

import { useState, useRef, DragEvent } from "react";
import { useRouter } from "next/navigation";

type Mode = "excel" | "natural";

const NATURAL_PLACEHOLDER = `테스트할 내용을 자유롭게 작성하세요.

예시)
1. 로그인 페이지로 이동한다
2. 병원코드 입력칸에 'H001'을 입력한다
3. 비밀번호 입력칸에 'pass1234'를 입력한다
4. 로그인 버튼을 클릭한다
5. 메인 대시보드 화면이 표시되는지 확인한다`;

export default function UploadPage() {
  const [targetUrl, setTargetUrl] = useState("");
  const [mode, setMode] = useState<Mode>("excel");
  const [file, setFile] = useState<File | null>(null);
  const [scenarios, setScenarios] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const isReady =
    targetUrl.trim() !== "" &&
    (mode === "excel" ? !!file : scenarios.trim().length > 10);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".xlsx")) { setFile(f); setError(""); }
    else setError(".xlsx 파일만 업로드할 수 있습니다.");
  };

  const handleSubmit = async () => {
    if (!isReady || isLoading) return;
    setIsLoading(true);
    setError("");

    try {
      let res: Response;

      if (mode === "excel") {
        const form = new FormData();
        form.append("excel", file!);
        form.append("url", targetUrl);
        res = await fetch("/api/trigger", { method: "POST", body: form });
      } else {
        res = await fetch("/api/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "natural", url: targetUrl, scenarios }),
        });
      }

      const data = await res.json();
      if (data.run_id) {
        router.push(`/dashboard/${data.run_id}`);
      } else {
        setError(data.error || "실행에 실패했습니다.");
      }
    } catch {
      setError("Worker에 연결할 수 없습니다. Worker 서버가 실행 중인지 확인하세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-5">

        {/* 로고 */}
        <div className="mb-2 text-center space-y-1.5">
          <h1 className="text-5xl font-medium text-white" style={{ letterSpacing: "-2.5px" }}>
            QAgent
          </h1>
          <p className="text-sm text-[#999]">AI Native QA Automation Pipeline</p>
        </div>

        {/* ① 테스트 대상 URL */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-[#666] uppercase tracking-widest">
            테스트 대상 URL
          </label>
          <input
            type="url"
            value={targetUrl}
            onChange={(e) => { setTargetUrl(e.target.value); setError(""); }}
            placeholder="https://your-service.com"
            className="w-full rounded-xl border border-[#262626] bg-[#141414] px-4 py-3 text-sm text-white placeholder-[#3a3a3a] outline-none transition-colors focus:border-[#0099ff] focus:ring-1 focus:ring-[#0099ff]/20"
          />
        </div>

        {/* ② 시나리오 입력 영역 */}
        <div className="space-y-3">
          <label className="block text-xs font-medium text-[#666] uppercase tracking-widest">
            테스트 시나리오
          </label>

          {/* 모드 탭 */}
          <div className="flex rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] p-1">
            {(["excel", "natural"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  mode === m ? "bg-[#1c1c1c] text-white" : "text-[#555] hover:text-[#888]"
                }`}
              >
                {m === "excel" ? "엑셀 업로드" : "자연어 입력"}
              </button>
            ))}
          </div>

          {/* 엑셀 업로드 */}
          {mode === "excel" && (
            <div
              className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
                isDragging
                  ? "border-[#0099ff] bg-[#0099ff]/5"
                  : "border-[#262626] hover:border-[#3a3a3a]"
              }`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => { setFile(e.target.files?.[0] || null); setError(""); }}
              />
              {file ? (
                <div className="space-y-1">
                  <p className="font-medium text-white">{file.name}</p>
                  <p className="text-sm text-[#666]">{(file.size / 1024).toFixed(1)} KB</p>
                  <button
                    className="mt-2 text-xs text-[#0099ff] hover:underline"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  >
                    파일 변경
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#2a2a2a] text-[#444]">
                    ↑
                  </div>
                  <p className="text-sm text-[#666]">
                    xlsx 파일을 드래그하거나<br />클릭해서 업로드
                  </p>
                  <p className="text-xs text-[#3a3a3a]">
                    컬럼: 구분 · 테스트ID · 기능 · 시나리오 · 전제조건 · 입력값/동작 · 기대결과
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 자연어 입력 */}
          {mode === "natural" && (
            <div className="space-y-2">
              <textarea
                value={scenarios}
                onChange={(e) => { setScenarios(e.target.value); setError(""); }}
                placeholder={NATURAL_PLACEHOLDER}
                rows={11}
                className="w-full resize-none rounded-2xl border border-[#262626] bg-[#141414] px-4 py-3.5 text-sm text-white placeholder-[#333] outline-none transition-colors focus:border-[#0099ff] focus:ring-1 focus:ring-[#0099ff]/20"
              />
              <div className="flex items-start gap-1.5 text-xs text-[#444]">
                <span className="mt-0.5 shrink-0 text-[#0099ff]">i</span>
                <span>
                  GPT-4o가 자연어를 분석해 테스트를 자동 실행합니다.
                  ANTHROPIC_API_KEY가 설정되어 있어야 합니다.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 오류 메시지 */}
        {error && (
          <div className="rounded-xl border border-red-800/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* 제출 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!isReady || isLoading}
          className="w-full rounded-full bg-white py-3 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-25"
        >
          {isLoading ? "실행 중…" : "테스트 시작"}
        </button>

      </div>
    </main>
  );
}
