"use client";

import { useState, useRef, DragEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Mode = "excel" | "natural";
interface ScenarioCard { id: number; text: string; }

const CARD_PLACEHOLDER = `테스트 시나리오를 자유롭게 작성하세요.

예시)
1. 로그인 페이지로 이동한다
2. 병원코드 입력칸에 'H001'을 입력한다
3. 비밀번호 입력칸에 'pass1234'를 입력한다
4. 로그인 버튼을 클릭한다
5. 메인 대시보드가 표시되는지 확인한다`;

const EXECUTOR_CHIPS = ["기획", "디자인", "프론트엔드", "백엔드", "QA"];
let nextId = 2;

const A = {
  blue:      "#0066cc",
  canvas:    "#ffffff",
  parchment: "#f5f5f7",
  ink:       "#1d1d1f",
  inkMuted:  "#6b7280",
  inkFaint:  "#9ca3af",
  hairline:  "#e0e0e0",
  divider:   "#f0f0f0",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 8,
  border: `1px solid ${A.hairline}`,
  background: A.canvas,
  padding: "10px 14px",
  fontSize: 14,
  color: A.ink,
  outline: "none",
  transition: "border-color .15s, box-shadow .15s",
  letterSpacing: "-0.2px",
};

export default function NewPage() {
  return <Suspense><NewTestForm /></Suspense>;
}

function NewTestForm() {
  const [targetUrl, setTargetUrl]   = useState("");
  const [mode, setMode]             = useState<Mode>("natural");
  const [file, setFile]             = useState<File | null>(null);
  const [cards, setCards]           = useState<ScenarioCard[]>([{ id: 1, text: "" }]);
  const [executor, setExecutor]     = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = searchParams.get("url");
    const sc  = searchParams.get("scenarios");
    const ex  = searchParams.get("executor");
    if (url) setTargetUrl(url);
    if (sc)  { setMode("natural"); setCards([{ id: 1, text: sc }]); }
    if (ex)  setExecutor(ex);
  }, []);

  const filledCards = cards.filter((c) => c.text.trim().length > 0);
  const isReady = targetUrl.trim() !== "" && (mode === "excel" ? !!file : filledCards.length > 0);

  const addCard    = () => setCards((p) => [...p, { id: nextId++, text: "" }]);
  const removeCard = (id: number) => setCards((p) => p.length > 1 ? p.filter((c) => c.id !== id) : p);
  const updateCard = (id: number, text: string) => { setCards((p) => p.map((c) => c.id === id ? { ...c, text } : c)); setError(""); };

  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".xlsx")) { setFile(f); setError(""); }
    else setError(".xlsx 파일만 업로드할 수 있습니다.");
  };

  const handleSubmit = async () => {
    if (!isReady || isLoading) return;
    setIsLoading(true); setError("");
    try {
      let res: Response;
      if (mode === "excel") {
        const form = new FormData();
        form.append("excel", file!);
        form.append("url", targetUrl);
        if (executor.trim()) form.append("executor", executor.trim());
        res = await fetch("/api/trigger", { method: "POST", body: form });
      } else {
        res = await fetch("/api/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "natural", url: targetUrl, scenarios: filledCards.map((c) => c.text.trim()), executor: executor.trim() || undefined }),
        });
      }
      const data = await res.json();
      if (data.run_id) router.push(`/dashboard/${data.run_id}`);
      else setError(data.error || "실행에 실패했습니다.");
    } catch {
      setError("Worker에 연결할 수 없습니다. Worker 서버가 실행 중인지 확인하세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 헤더 */}
      <header style={{
        background: A.canvas,
        borderBottom: `1px solid ${A.hairline}`,
        padding: "0 28px",
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: A.inkFaint }}>QAgent</span>
          <span style={{ fontSize: 13, color: A.hairline }}>/</span>
          <span style={{ fontSize: 13, color: A.ink, fontWeight: 600 }}>새 테스트</span>
        </div>
        <Link href="/dashboard/demo" style={{ fontSize: 13, color: A.blue, textDecoration: "none" }}>UI 미리보기 →</Link>
      </header>

      {/* 폼 */}
      <main style={{ flex: 1, overflowY: "auto", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 20 }}>

          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <h1 style={{ fontSize: 34, fontWeight: 600, color: A.ink, letterSpacing: "-0.374px", marginBottom: 8 }}>새 테스트 실행</h1>
            <p style={{ fontSize: 17, color: A.inkMuted, letterSpacing: "-0.374px", lineHeight: 1.47 }}>AI가 화면을 보며 시나리오를 자동으로 수행합니다</p>
          </div>

          {/* 폼 카드 */}
          <div style={{
            background: A.canvas,
            border: `1px solid ${A.hairline}`,
            borderRadius: 18,
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}>

            {/* ① URL */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: A.inkMuted, letterSpacing: "-0.1px" }}>테스트 대상 URL</label>
              <div style={{ position: "relative" }}>
                <input
                  type="url" value={targetUrl}
                  onChange={(e) => { setTargetUrl(e.target.value); setError(""); }}
                  placeholder="https://your-service.com"
                  style={{ ...inputStyle, paddingRight: 40 }}
                  onFocus={(e) => { e.target.style.borderColor = A.blue; e.target.style.boxShadow = `0 0 0 3px rgba(0,102,204,0.1)`; }}
                  onBlur={(e) => { e.target.style.borderColor = A.hairline; e.target.style.boxShadow = "none"; }}
                />
                {/^https?:\/\/.+\..+/.test(targetUrl.trim()) && (
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#16a34a" }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M5 8l2 2.5 4-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
              </div>
            </div>

            {/* ② 시나리오 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: A.inkMuted, letterSpacing: "-0.1px" }}>테스트 시나리오</label>

              {/* 모드 탭 */}
              <div style={{ display: "flex", gap: 4, background: A.parchment, borderRadius: 10, padding: 4, border: `1px solid ${A.hairline}` }}>
                {(["excel", "natural"] as Mode[]).map((m) => (
                  <button key={m} onClick={() => { setMode(m); setError(""); }}
                    style={{
                      flex: 1, padding: "8px 14px", borderRadius: 7, fontSize: 14, fontWeight: mode === m ? 500 : 400,
                      border: "none", cursor: "pointer", transition: "all .12s",
                      background: mode === m ? A.canvas : "transparent",
                      color: mode === m ? A.ink : A.inkMuted,
                      boxShadow: mode === m ? `0 1px 3px rgba(0,0,0,0.08)` : "none",
                      letterSpacing: "-0.2px",
                    }}>
                    {m === "excel" ? "엑셀 업로드" : "자연어 입력"}
                  </button>
                ))}
              </div>

              {/* 엑셀 업로드 */}
              {mode === "excel" && (
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  style={{
                    cursor: "pointer", borderRadius: 12, padding: "32px 24px", textAlign: "center",
                    border: `2px dashed ${isDragging ? A.blue : A.hairline}`,
                    background: isDragging ? "#eff6ff" : A.parchment,
                    transition: "all .15s",
                  }}
                >
                  <input ref={fileRef} type="file" accept=".xlsx" style={{ display: "none" }} onChange={(e) => { setFile(e.target.files?.[0] || null); setError(""); }} />
                  {file ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: A.ink, letterSpacing: "-0.2px" }}>{file.name}</p>
                      <p style={{ fontSize: 12, color: A.inkFaint }}>{(file.size / 1024).toFixed(1)} KB</p>
                      <button onClick={(e) => { e.stopPropagation(); setFile(null); }} style={{ marginTop: 6, fontSize: 13, color: A.blue, background: "none", border: "none", cursor: "pointer" }}>파일 변경</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: A.canvas, border: `1px solid ${A.hairline}`, display: "flex", alignItems: "center", justifyContent: "center", color: A.inkMuted, fontSize: 18 }}>↑</div>
                      <p style={{ fontSize: 14, color: A.inkMuted, letterSpacing: "-0.2px" }}>xlsx 파일을 드래그하거나 클릭해서 업로드</p>
                      <p style={{ fontSize: 12, color: A.inkFaint }}>컬럼: 구분 · 테스트ID · 기능 · 시나리오 · 전제조건 · 입력값/동작 · 기대결과</p>
                    </div>
                  )}
                </div>
              )}

              {/* 자연어 입력 */}
              {mode === "natural" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {cards.map((card, idx) => (
                    <div key={card.id} style={{ borderRadius: 10, border: `1px solid ${A.hairline}`, background: A.canvas, overflow: "hidden", transition: "border-color .15s" }}
                      onFocusCapture={(e) => e.currentTarget.style.borderColor = A.blue}
                      onBlurCapture={(e) => e.currentTarget.style.borderColor = A.hairline}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px 4px" }}>
                        <span style={{ fontSize: 11, fontWeight: 500, color: A.inkFaint }}>케이스 {idx + 1}</span>
                        {cards.length > 1 && (
                          <button onClick={() => removeCard(card.id)} style={{ background: "none", border: "none", cursor: "pointer", color: A.hairline, padding: 2 }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = A.hairline)}
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 6v4M8.5 6v4M3 3.5l.7 7.2a.5.5 0 00.5.3h5.6a.5.5 0 00.5-.3L11 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        )}
                      </div>
                      <textarea value={card.text} onChange={(e) => updateCard(card.id, e.target.value)} placeholder={CARD_PLACEHOLDER} rows={6}
                        style={{ width: "100%", resize: "none", background: "transparent", padding: "4px 14px 12px", fontSize: 14, color: A.ink, outline: "none", border: "none", letterSpacing: "-0.2px", lineHeight: 1.5 }} />
                    </div>
                  ))}
                  <button onClick={addCard} style={{
                    width: "100%", borderRadius: 10, padding: "11px", fontSize: 14, color: A.blue, fontWeight: 400,
                    border: `1.5px dashed ${A.hairline}`, background: "transparent", cursor: "pointer", transition: "all .12s",
                    letterSpacing: "-0.2px",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = A.parchment; e.currentTarget.style.borderColor = A.blue; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = A.hairline; }}
                  >
                    + 테스트 케이스 추가
                  </button>
                  <p style={{ fontSize: 12, color: A.inkFaint, lineHeight: 1.5 }}>
                    각 카드는 독립된 테스트 케이스로 실행됩니다. Claude가 화면을 보며 직접 조작합니다.
                  </p>
                </div>
              )}
            </div>

            {/* ③ 실행자 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: A.inkMuted, letterSpacing: "-0.1px" }}>실행자 정보</label>
              <input
                type="text" value={executor}
                onChange={(e) => setExecutor(e.target.value)}
                placeholder="담당자 이름 또는 직무"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = A.blue; e.target.style.boxShadow = `0 0 0 3px rgba(0,102,204,0.1)`; }}
                onBlur={(e) => { e.target.style.borderColor = A.hairline; e.target.style.boxShadow = "none"; }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {EXECUTOR_CHIPS.map((chip) => (
                  <button key={chip} onClick={() => setExecutor((prev) => prev === chip ? "" : chip)}
                    style={{
                      borderRadius: 9999, padding: "4px 12px", fontSize: 13, fontWeight: 400, cursor: "pointer",
                      border: executor === chip ? `1.5px solid ${A.blue}` : `1px solid ${A.hairline}`,
                      background: executor === chip ? "#eff6ff" : A.canvas,
                      color: executor === chip ? A.blue : A.inkMuted,
                      transition: "all .12s", letterSpacing: "-0.1px",
                    }}>
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* 오류 */}
            {error && (
              <div style={{ borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", padding: "10px 14px", fontSize: 14, color: "#dc2626", letterSpacing: "-0.2px" }}>
                {error}
              </div>
            )}

            {/* 제출 버튼 */}
            <button
              onClick={handleSubmit}
              disabled={!isReady || isLoading}
              style={{
                width: "100%", borderRadius: 9999, padding: "13px",
                fontSize: 17, fontWeight: 400, letterSpacing: "-0.374px",
                border: "none", cursor: isReady && !isLoading ? "pointer" : "not-allowed",
                background: isReady && !isLoading ? A.blue : A.hairline,
                color: isReady && !isLoading ? "#fff" : A.inkFaint,
                transition: "opacity .15s",
              }}
              onMouseEnter={(e) => { if (isReady && !isLoading) e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              {isLoading
                ? "실행 중…"
                : mode === "natural"
                  ? `테스트 시작${filledCards.length > 0 ? ` (${filledCards.length}개 케이스)` : ""}`
                  : "테스트 시작"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
