"use client";

import { useState, useRef, DragEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "excel" | "natural";

interface ScenarioCard {
  id: number;
  text: string;
}

const CARD_PLACEHOLDER = `테스트 시나리오를 자유롭게 작성하세요.

예시)
1. 로그인 페이지로 이동한다
2. 병원코드 입력칸에 'H001'을 입력한다
3. 비밀번호 입력칸에 'pass1234'를 입력한다
4. 로그인 버튼을 클릭한다
5. 메인 대시보드가 표시되는지 확인한다`;

let nextId = 2;

export default function Page() {
  return (
    <Suspense>
      <UploadPage />
    </Suspense>
  );
}

function UploadPage() {
  const [targetUrl, setTargetUrl] = useState("");
  const [mode, setMode] = useState<Mode>("excel");
  const [file, setFile] = useState<File | null>(null);
  const [cards, setCards] = useState<ScenarioCard[]>([{ id: 1, text: "" }]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = searchParams.get("url");
    const sc = searchParams.get("scenarios");
    if (url) setTargetUrl(url);
    if (sc) {
      setMode("natural");
      // 기존 단일 문자열을 카드 하나로 복원
      setCards([{ id: 1, text: sc }]);
    }
  }, []);

  const filledCards = cards.filter((c) => c.text.trim().length > 10);
  const isReady =
    targetUrl.trim() !== "" &&
    (mode === "excel" ? !!file : filledCards.length > 0);

  const addCard = () => {
    setCards((prev) => [...prev, { id: nextId++, text: "" }]);
  };

  const removeCard = (id: number) => {
    setCards((prev) => prev.length > 1 ? prev.filter((c) => c.id !== id) : prev);
  };

  const updateCard = (id: number, text: string) => {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, text } : c));
    setError("");
  };

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
        const scenarios = filledCards.map((c) => c.text.trim());
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
          <label className="block text-xs font-medium text-[#999] uppercase tracking-widest">
            테스트 대상 URL
          </label>
          <input
            type="url"
            value={targetUrl}
            onChange={(e) => { setTargetUrl(e.target.value); setError(""); }}
            placeholder="https://your-service.com"
            className="w-full rounded-[10px] border border-[#262626] bg-[#141414] px-[14px] py-[10px] text-[15px] text-white placeholder-[#555] outline-none transition-colors focus:border-[#0099ff] focus:ring-1 focus:ring-[#0099ff]/20"
          />
        </div>

        {/* ② 시나리오 입력 영역 */}
        <div className="space-y-3">
          <label className="block text-xs font-medium text-[#999] uppercase tracking-widest">
            테스트 시나리오
          </label>

          {/* 모드 탭 */}
          <div className="flex gap-1 rounded-full border border-[#1a1a1a] bg-[#090909] p-1">
            {(["excel", "natural"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 rounded-full px-[14px] py-[8px] text-[14px] font-medium tracking-[-0.14px] transition-colors ${
                  mode === m
                    ? "bg-[#1c1c1c] text-white"
                    : "text-[#999] hover:text-white"
                }`}
              >
                {m === "excel" ? "엑셀 업로드" : "자연어 입력"}
              </button>
            ))}
          </div>

          {/* 엑셀 업로드 */}
          {mode === "excel" && (
            <div
              className={`cursor-pointer rounded-[30px] border-2 border-dashed p-10 text-center transition-colors ${
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
                  <p className="text-sm text-[#999]">
                    xlsx 파일을 드래그하거나<br />클릭해서 업로드
                  </p>
                  <p className="text-xs text-[#666]">
                    컬럼: 구분 · 테스트ID · 기능 · 시나리오 · 전제조건 · 입력값/동작 · 기대결과
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 자연어 입력 — 카드형 */}
          {mode === "natural" && (
            <div className="space-y-2">
              {cards.map((card, idx) => (
                <div
                  key={card.id}
                  className="group rounded-[12px] border border-[#262626] bg-[#141414] transition-colors focus-within:border-[#0099ff] focus-within:ring-1 focus-within:ring-[#0099ff]/20"
                >
                  {/* 카드 헤더 */}
                  <div className="flex items-center justify-between px-[14px] pt-[10px]">
                    <span className="text-xs font-medium text-[#555]">
                      케이스 {idx + 1}
                    </span>
                    {cards.length > 1 && (
                      <button
                        onClick={() => removeCard(card.id)}
                        className="text-[#444] transition-colors hover:text-red-400"
                        aria-label="케이스 삭제"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 6v4M8.5 6v4M3 3.5l.7 7.2a.5.5 0 00.5.3h5.6a.5.5 0 00.5-.3L11 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  {/* textarea */}
                  <textarea
                    value={card.text}
                    onChange={(e) => updateCard(card.id, e.target.value)}
                    placeholder={CARD_PLACEHOLDER}
                    rows={6}
                    className="w-full resize-none bg-transparent px-[14px] pb-[10px] pt-[6px] text-[14px] text-white placeholder-[#444] outline-none"
                  />
                </div>
              ))}

              {/* 케이스 추가 버튼 */}
              <button
                onClick={addCard}
                className="w-full rounded-[12px] border border-dashed border-[#2a2a2a] py-3 text-sm text-[#555] transition-colors hover:border-[#0099ff] hover:text-[#0099ff]"
              >
                + 테스트 케이스 추가
              </button>

              <div className="flex items-start gap-1.5 text-xs text-[#555]">
                <span className="mt-0.5 shrink-0 text-[#0099ff]">i</span>
                <span>각 카드는 독립된 테스트 케이스로 실행됩니다. Claude가 화면을 보며 직접 조작합니다.</span>
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
          className="w-full rounded-full bg-white px-[15px] py-[10px] text-[14px] font-medium tracking-[-0.14px] text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-25"
        >
          {isLoading
            ? "실행 중…"
            : mode === "natural"
              ? `테스트 시작 ${filledCards.length > 0 ? `(${filledCards.length}개 케이스)` : ""}`
              : "테스트 시작"}
        </button>

      </div>
    </main>
  );
}
