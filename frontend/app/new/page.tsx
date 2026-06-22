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

/* ─── 공통 스타일 ─────────────────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid rgba(209,213,219,0.8)",
  background: "rgba(255,255,255,0.75)",
  padding: "10px 14px",
  fontSize: 14,
  color: "#111827",
  outline: "none",
  transition: "border-color .15s, box-shadow .15s",
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
      {/* 상단 헤더 (글래스) */}
      <header style={{
        background: "rgba(255,255,255,0.45)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.6)",
        padding: "0 28px",
        height: 54,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        boxShadow: "0 4px 20px rgba(99,102,241,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#a5b4fc", fontWeight: 500 }}>QAgent</span>
          <span style={{ fontSize: 12, color: "#d1d5db" }}>/</span>
          <span style={{ fontSize: 12, color: "#4338ca", fontWeight: 600 }}>새 테스트</span>
        </div>
        <Link href="/dashboard/demo" style={{ fontSize: 12, color: "#9ca3af", textDecoration: "none" }}>UI 미리보기 →</Link>
      </header>

      {/* 폼 영역 */}
      <main style={{ flex: 1, overflowY: "auto", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "36px 24px" }}>
        <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 18 }}>

          {/* 제목 */}
          <div style={{ textAlign: "center", marginBottom: 4 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1e1b4b", letterSpacing: "-1px", marginBottom: 6 }}>새 테스트 실행</h1>
            <p style={{ fontSize: 13, color: "#9ca3af" }}>AI가 화면을 보며 시나리오를 자동으로 수행합니다</p>
          </div>

          {/* 폼 카드 */}
          <div style={{
            background: "rgba(255,255,255,0.75)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.8)",
            borderRadius: 18,
            boxShadow: "0 8px 40px rgba(99,102,241,0.10)",
            padding: "28px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}>

            {/* ① URL */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase" }}>테스트 대상 URL</label>
              <div style={{ position: "relative" }}>
                <input
                  type="url" value={targetUrl}
                  onChange={(e) => { setTargetUrl(e.target.value); setError(""); }}
                  placeholder="https://your-service.com"
                  style={{ ...inputStyle, paddingRight: 40 }}
                  onFocus={(e) => { e.target.style.borderColor = "#818cf8"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(209,213,219,0.8)"; e.target.style.boxShadow = "none"; }}
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
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase" }}>테스트 시나리오</label>

              {/* 모드 탭 */}
              <div style={{ display: "flex", gap: 4, background: "rgba(241,243,249,0.8)", borderRadius: 10, padding: 4, border: "1px solid rgba(229,231,235,0.6)" }}>
                {(["excel", "natural"] as Mode[]).map((m) => (
                  <button key={m} onClick={() => { setMode(m); setError(""); }}
                    style={{
                      flex: 1, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                      border: "none", cursor: "pointer", transition: "all .15s",
                      background: mode === m ? "#fff" : "transparent",
                      color: mode === m ? "#4338ca" : "#9ca3af",
                      boxShadow: mode === m ? "0 1px 6px rgba(99,102,241,0.12)" : "none",
                      fontWeight: mode === m ? 600 : 400,
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
                    cursor: "pointer", borderRadius: 14, padding: "36px 24px", textAlign: "center",
                    border: `2px dashed ${isDragging ? "#818cf8" : "rgba(209,213,219,0.7)"}`,
                    background: isDragging ? "rgba(238,242,255,0.6)" : "rgba(249,250,251,0.5)",
                    transition: "all .15s",
                  }}
                >
                  <input ref={fileRef} type="file" accept=".xlsx" style={{ display: "none" }} onChange={(e) => { setFile(e.target.files?.[0] || null); setError(""); }} />
                  {file ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{file.name}</p>
                      <p style={{ fontSize: 12, color: "#9ca3af" }}>{(file.size / 1024).toFixed(1)} KB</p>
                      <button onClick={(e) => { e.stopPropagation(); setFile(null); }} style={{ marginTop: 6, fontSize: 12, color: "#6366f1", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>파일 변경</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(238,242,255,0.8)", border: "1px solid rgba(199,210,254,0.6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#818cf8" }}>↑</div>
                      <p style={{ fontSize: 13, color: "#6b7280" }}>xlsx 파일을 드래그하거나 클릭해서 업로드</p>
                      <p style={{ fontSize: 11, color: "#9ca3af" }}>컬럼: 구분 · 테스트ID · 기능 · 시나리오 · 전제조건 · 입력값/동작 · 기대결과</p>
                    </div>
                  )}
                </div>
              )}

              {/* 자연어 입력 */}
              {mode === "natural" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {cards.map((card, idx) => (
                    <div key={card.id} style={{ borderRadius: 12, border: "1px solid rgba(209,213,219,0.7)", background: "rgba(255,255,255,0.7)", overflow: "hidden", transition: "border-color .15s" }}
                      onFocusCapture={(e) => e.currentTarget.style.borderColor = "#818cf8"}
                      onBlurCapture={(e) => e.currentTarget.style.borderColor = "rgba(209,213,219,0.7)"}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px 4px" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>케이스 {idx + 1}</span>
                        {cards.length > 1 && (
                          <button onClick={() => removeCard(card.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", padding: 2 }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#d1d5db")}
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 6v4M8.5 6v4M3 3.5l.7 7.2a.5.5 0 00.5.3h5.6a.5.5 0 00.5-.3L11 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        )}
                      </div>
                      <textarea value={card.text} onChange={(e) => updateCard(card.id, e.target.value)} placeholder={CARD_PLACEHOLDER} rows={6}
                        style={{ width: "100%", resize: "none", background: "transparent", padding: "4px 14px 12px", fontSize: 13, color: "#111827", outline: "none", border: "none" }} />
                    </div>
                  ))}
                  <button onClick={addCard} style={{
                    width: "100%", borderRadius: 12, padding: "11px", fontSize: 13, color: "#818cf8", fontWeight: 500,
                    border: "1.5px dashed rgba(129,140,248,0.4)", background: "transparent", cursor: "pointer", transition: "all .15s",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(238,242,255,0.5)"; e.currentTarget.style.borderColor = "#818cf8"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(129,140,248,0.4)"; }}
                  >
                    + 테스트 케이스 추가
                  </button>
                  <p style={{ fontSize: 11, color: "#9ca3af", display: "flex", gap: 5, alignItems: "flex-start" }}>
                    <span style={{ color: "#818cf8", flexShrink: 0, marginTop: 1 }}>i</span>
                    각 카드는 독립된 테스트 케이스로 실행됩니다. Claude가 화면을 보며 직접 조작합니다.
                  </p>
                </div>
              )}
            </div>

            {/* ③ 실행자 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase" }}>실행자 정보</label>
              <input
                type="text" value={executor}
                onChange={(e) => setExecutor(e.target.value)}
                placeholder="담당자 이름 또는 직무"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = "#818cf8"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(209,213,219,0.8)"; e.target.style.boxShadow = "none"; }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {EXECUTOR_CHIPS.map((chip) => (
                  <button key={chip} onClick={() => setExecutor((prev) => prev === chip ? "" : chip)}
                    style={{
                      borderRadius: 99, padding: "4px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer",
                      border: executor === chip ? "1.5px solid #818cf8" : "1px solid rgba(209,213,219,0.8)",
                      background: executor === chip ? "rgba(238,242,255,0.9)" : "rgba(255,255,255,0.6)",
                      color: executor === chip ? "#4338ca" : "#6b7280",
                      transition: "all .12s",
                    }}>
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* 오류 메시지 */}
            {error && (
              <div style={{ borderRadius: 10, background: "rgba(254,242,242,0.9)", border: "1px solid #fecaca", padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
                {error}
              </div>
            )}

            {/* 제출 버튼 */}
            <button
              onClick={handleSubmit}
              disabled={!isReady || isLoading}
              style={{
                width: "100%", borderRadius: 12, padding: "13px",
                fontSize: 14, fontWeight: 700, letterSpacing: "-0.2px",
                border: "none", cursor: isReady && !isLoading ? "pointer" : "not-allowed",
                background: isReady && !isLoading
                  ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                  : "rgba(209,213,219,0.5)",
                color: isReady && !isLoading ? "#fff" : "#9ca3af",
                boxShadow: isReady && !isLoading ? "0 4px 16px rgba(99,102,241,0.3)" : "none",
                transition: "all .15s",
              }}
              onMouseEnter={(e) => { if (isReady && !isLoading) e.currentTarget.style.opacity = "0.9"; }}
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
