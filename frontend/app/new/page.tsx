"use client";

import { useState, useRef, DragEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "natural" | "excel";
interface ScenarioCard { id: number; text: string; }
interface LoginField { id: number; label: string; customLabel?: string; value: string; isPassword: boolean; }

const CARD_PLACEHOLDER = `테스트 시나리오를 단계별로 작성하세요.
마지막에 "무엇이 보이면 성공"인지 적으면 검증이 정확해집니다.

예시)
1. 사용자 관리 메뉴를 클릭한다
2. 새 사용자 추가 버튼을 클릭한다
3. 이름에 "테스트", 이메일에 "test@test.com"을 입력하고 저장한다
4. 목록에 "테스트" 사용자가 표시되면 성공`;

const LOGIN_LABEL_OPTIONS = ["아이디 / 이메일", "비밀번호", "테넌시 ID", "워크스페이스 코드", "기관 코드", "직접 입력"];

const DEFAULT_LOGIN_FIELDS = (): LoginField[] => [
  { id: 1, label: "", value: "", isPassword: false },
  { id: 2, label: "비밀번호", value: "", isPassword: true },
];
let nextCardId = 2;
let nextFieldId = 3;


/* ─── Apple design tokens ───────────────────────────────────────── */
const A = {
  blue:      "#0066cc",
  blueDark:  "#0055b3",
  blueFocus: "#0071e3",
  ink:       "#1d1d1f",
  inkMuted:  "#6b7280",
  hairline:  "#e0e0e0",
  divider:   "#f0f0f0",
  canvas:    "#ffffff",
  parchment: "#f5f5f7",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: `1px solid ${A.hairline}`,
  background: A.canvas,
  padding: "10px 14px",
  fontSize: 14,
  color: A.ink,
  outline: "none",
  transition: "border-color .15s, box-shadow .15s",
  boxSizing: "border-box",
};

export default function NewPage() {
  return <Suspense><NewTestForm /></Suspense>;
}

const ADMIN_VERIFIED_KEY = "qagent_admin_verified";

function NewTestForm() {
  const [adminVerified, setAdminVerified] = useState(false);
  const [adminChecked, setAdminChecked]   = useState(false); // sessionStorage 확인 완료 여부 (깜빡임 방지)
  const [targetUrl, setTargetUrl]       = useState("");
  const [mode, setMode]                 = useState<Mode>("natural");
  const [file, setFile]                 = useState<File | null>(null);
  const [cards, setCards]               = useState<ScenarioCard[]>([{ id: 1, text: "" }]);
  const [isDragging, setIsDragging]     = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState("");
  const [loginOpen, setLoginOpen]       = useState(false);
  const [loginFields, setLoginFields]   = useState<LoginField[]>(DEFAULT_LOGIN_FIELDS());
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();


  useEffect(() => {
    const url = searchParams.get("url");
    const sc  = searchParams.get("scenarios");
    if (url) setTargetUrl(url);
    if (sc)  { setMode("natural"); setCards([{ id: 1, text: sc }]); }
  }, []);

  // 새 테스트 생성(=API 크레딧 소비)은 관리자 비밀번호 인증 후에만 가능
  useEffect(() => {
    if (sessionStorage.getItem(ADMIN_VERIFIED_KEY) === "1") setAdminVerified(true);
    setAdminChecked(true);
  }, []);

  const filledCards = cards.filter((c) => c.text.trim().length > 0);
  const hasLogin = loginFields.some((f) => f.value.trim() !== "");
  const isReady = targetUrl.trim() !== "" && (mode === "excel" ? !!file : filledCards.length > 0);

  /* ── 카드 핸들러 ── */
  const addCard    = () => setCards((p) => [...p, { id: nextCardId++, text: "" }]);
  const removeCard = (id: number) => setCards((p) => p.length > 1 ? p.filter((c) => c.id !== id) : p);
  const updateCard = (id: number, text: string) => { setCards((p) => p.map((c) => c.id === id ? { ...c, text } : c)); setError(""); };

  // 줄바꿈(Enter) 시 다음 줄 시작에 자동으로 번호를 붙여준다 (1. 2. 3. ...)
  const handleScenarioKeyDown = (id: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 한국어 IME 조합 중 Enter는 글자 확정 이벤트이므로 무시
    if (e.nativeEvent.isComposing || e.key !== "Enter" || e.shiftKey) return;
    const textarea = e.currentTarget;
    const { selectionStart, value } = textarea;
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionStart);

    // 지금까지 입력한 줄 중 "N. " 형태로 시작하는 줄의 개수로 다음 번호를 추정
    const numberedLines = before.match(/^\s*\d+\.\s/gm) || [];
    if (numberedLines.length === 0) return; // 아직 번호 매기기를 시작하지 않았으면 기본 줄바꿈 동작 유지

    e.preventDefault();
    const nextNum = numberedLines.length + 1;
    const insertion = `\n${nextNum}. `;
    updateCard(id, before + insertion + after);

    requestAnimationFrame(() => {
      const pos = before.length + insertion.length;
      textarea.selectionStart = textarea.selectionEnd = pos;
    });
  };

  // 빈 칸에서 첫 글자를 입력하면 "1. "을 자동으로 붙여준다
  const handleScenarioChange = (id: number, prevText: string, nextValue: string) => {
    if (prevText === "" && nextValue !== "" && !/^\s*\d+\.\s/.test(nextValue)) {
      updateCard(id, `1. ${nextValue}`);
    } else {
      updateCard(id, nextValue);
    }
  };

  /* ── 로그인 필드 핸들러 ── */
  const addLoginField = () => setLoginFields((p) => [...p, { id: nextFieldId++, label: "", value: "", isPassword: false }]);
  const removeLoginField = (id: number) => setLoginFields((p) => p.length > 1 ? p.filter((f) => f.id !== id) : p);
  const updateLoginField = (id: number, key: keyof LoginField, val: string | boolean) =>
    setLoginFields((p) => p.map((f) => f.id === id ? { ...f, [key]: val } : f));


  // http(s):// 프로토콜이 없으면 https://를 자동으로 붙여준다 (로컬 테스트용 http:// 직접 입력은 그대로 존중)
  const normalizeUrl = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return trimmed;
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

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
      const loginConfig = hasLogin
        ? { fields: loginFields.map(({ label, value, isPassword }) => ({ label, value, isPassword })) }
        : undefined;

      const url = normalizeUrl(targetUrl);

      if (mode === "excel") {
        const form = new FormData();
        form.append("excel", file!);
        form.append("url", url);
        res = await fetch("/api/trigger", { method: "POST", body: form });
      } else {
        res = await fetch("/api/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "natural",
            url,
            scenarios: filledCards.map((c) => c.text.trim()),
            loginConfig,
          }),
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

  // 관리자 인증 전: 본 폼 대신 비밀번호 모달만 노출 (sessionStorage 확인 전엔 깜빡임 방지를 위해 빈 화면)
  if (!adminChecked) return null;
  if (!adminVerified) {
    return <AdminGateModal onVerified={() => { sessionStorage.setItem(ADMIN_VERIFIED_KEY, "1"); setAdminVerified(true); }} />;
  }

  return (
    <>
      {/* 헤더 */}
      <header style={{
        background: A.canvas,
        borderBottom: `1px solid ${A.divider}`,
        padding: "0 28px",
        height: 54,
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: A.inkMuted, fontWeight: 500 }}>QAgent</span>
          <span style={{ fontSize: 12, color: A.hairline }}>/</span>
          <span style={{ fontSize: 12, color: A.blue, fontWeight: 600 }}>새 테스트</span>
        </div>
      </header>

      {/* 폼 */}
      <main style={{ flex: 1, overflowY: "auto", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "36px 24px", background: A.parchment }}>
        <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 18 }}>

          {/* 제목 */}
          <div style={{ textAlign: "center", marginBottom: 4 }}>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: A.ink, letterSpacing: "-0.5px", marginBottom: 6 }}>새 테스트 실행</h1>
            <p style={{ fontSize: 13, color: A.inkMuted }}>AI 에이전트가 실제 화면 구조를 분석하며 시나리오를 단계별로 수행합니다</p>
          </div>

          {/* 폼 카드 */}
          <div style={{
            background: A.canvas,
            border: `1px solid ${A.hairline}`,
            borderRadius: 18,
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}>

            {/* ① URL */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: A.inkMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>테스트 대상 URL</label>
              <div style={{ position: "relative" }}>
                <input
                  type="text" value={targetUrl}
                  onChange={(e) => { setTargetUrl(e.target.value); setError(""); }}
                  placeholder="your-service.com (https:// 생략 가능)"
                  style={{ ...inputStyle, paddingRight: 40 }}
                  onFocus={(e) => { e.target.style.borderColor = A.blue; e.target.style.boxShadow = `0 0 0 3px rgba(0,102,204,0.1)`; }}
                  onBlur={(e) => { e.target.style.borderColor = A.hairline; e.target.style.boxShadow = "none"; }}
                />
                {/^(https?:\/\/)?.+\..+/.test(targetUrl.trim()) && (
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#16a34a" }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M5 8l2 2.5 4-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
              </div>
            </div>

            {/* ② 로그인 설정 */}
            <div style={{ borderRadius: 12, border: `1px solid ${A.hairline}`, overflow: "hidden" }}>
              {/* 헤더 */}
              <button
                onClick={() => setLoginOpen((p) => !p)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", background: loginOpen ? A.parchment : A.canvas,
                  border: "none", cursor: "pointer", borderBottom: loginOpen ? `1px solid ${A.hairline}` : "none",
                  transition: "background .12s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" fill="none" stroke={hasLogin ? A.blue : A.inkMuted} strokeWidth="1.8" viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: 12, fontWeight: 600, color: hasLogin ? A.blue : A.inkMuted }}>
                    로그인 정보
                  </span>
                  {!hasLogin && (
                    <span style={{ fontSize: 11, color: A.inkMuted, fontWeight: 400 }}>선택사항 — 로그인이 필요한 테스트에 사용</span>
                  )}
                </div>
                <svg width="12" height="12" fill="none" stroke={A.inkMuted} strokeWidth="2" viewBox="0 0 12 12"
                  style={{ transform: loginOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
                  <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* 로그인 필드 목록 */}
              {loginOpen && (
                <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {loginFields.map((field) => (
                    <div key={field.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {/* 라벨 — 실제 폼 라벨과 동일하게 입력 */}
                      <div style={{ width: 140, flexShrink: 0 }}>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => {
                            updateLoginField(field.id, "label", e.target.value);
                            updateLoginField(field.id, "isPassword", /비밀번호|password/i.test(e.target.value));
                          }}
                          placeholder="예: 병원 ID"
                          style={{ ...inputStyle, fontSize: 12, padding: "8px 10px" }}
                          onFocus={(e) => { e.target.style.borderColor = A.blue; e.target.style.boxShadow = `0 0 0 3px rgba(0,102,204,0.1)`; }}
                          onBlur={(e) => { e.target.style.borderColor = A.hairline; e.target.style.boxShadow = "none"; }}
                        />
                      </div>
                      {/* 값 */}
                      <div style={{ position: "relative", flex: 1 }}>
                        <input
                          type={field.isPassword ? "password" : "text"}
                          value={field.value}
                          onChange={(e) => updateLoginField(field.id, "value", e.target.value)}
                          placeholder="값 입력"
                          style={{ ...inputStyle, fontSize: 13, padding: "8px 34px 8px 10px" }}
                          onFocus={(e) => { e.target.style.borderColor = A.blue; e.target.style.boxShadow = `0 0 0 3px rgba(0,102,204,0.1)`; }}
                          onBlur={(e) => { e.target.style.borderColor = A.hairline; e.target.style.boxShadow = "none"; }}
                        />
                        {/* 마스킹 토글 */}
                        <button
                          onClick={() => updateLoginField(field.id, "isPassword", !field.isPassword)}
                          title={field.isPassword ? "값 보기" : "값 숨기기"}
                          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: A.inkMuted, padding: 2 }}
                        >
                          {field.isPassword
                            ? <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/></svg>
                            : <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          }
                        </button>
                      </div>
                      {/* 삭제 */}
                      <div style={{ paddingTop: 8 }}>
                        {loginFields.length > 1 && (
                          <button onClick={() => removeLoginField(field.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: A.hairline, padding: 4, flexShrink: 0 }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = A.hairline)}
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5.5 6v4M8.5 6v4M3 3.5l.7 7.2a.5.5 0 00.5.3h5.6a.5.5 0 00.5-.3L11 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* 필드 추가 + 저장 */}
                  <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                    <button onClick={addLoginField} style={{
                      flex: 1, padding: "7px", borderRadius: 8, fontSize: 12, color: A.blue, fontWeight: 500,
                      border: `1.5px dashed rgba(0,102,204,0.3)`, background: "transparent", cursor: "pointer",
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,102,204,0.04)"; e.currentTarget.style.borderColor = A.blue; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(0,102,204,0.3)"; }}
                    >
                      + 필드 추가
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                    라벨은 실제 로그인 폼에 표시된 이름과 동일하게 입력하세요 (예: 병원 ID, 계정, 비밀번호)
                  </p>
                </div>
              )}
            </div>

            {/* ③ 시나리오 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: A.inkMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>테스트 시나리오</label>

              {/* 모드 탭 */}
              <div style={{ display: "flex", gap: 4, background: A.parchment, borderRadius: 10, padding: 4, border: `1px solid ${A.hairline}` }}>
                {(["natural", "excel"] as Mode[]).map((m) => (
                  <button key={m} onClick={() => { setMode(m); setError(""); }}
                    style={{
                      flex: 1, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                      border: "none", cursor: "pointer", transition: "all .15s",
                      background: mode === m ? A.canvas : "transparent",
                      color: mode === m ? A.blue : A.inkMuted,
                      boxShadow: mode === m ? `0 1px 4px rgba(0,0,0,0.08)` : "none",
                    }}>
                    {m === "natural" ? "자연어 입력" : "엑셀 업로드"}
                  </button>
                ))}
              </div>

              {/* 엑셀 업로드 */}
              {mode === "excel" && (
                <>
                  <a
                    href="/templates/qagent_template.xlsx"
                    download
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "8px", borderRadius: 9, fontSize: 12, fontWeight: 500,
                      color: A.blue, background: "rgba(0,102,204,0.05)", border: `1px solid rgba(0,102,204,0.15)`,
                      textDecoration: "none", marginBottom: 4,
                    }}
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    엑셀 양식 다운로드
                  </a>
                  <div
                    onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  style={{
                    cursor: "pointer", borderRadius: 12, padding: "36px 24px", textAlign: "center",
                    border: `2px dashed ${isDragging ? A.blue : A.hairline}`,
                    background: isDragging ? "rgba(0,102,204,0.04)" : A.parchment,
                    transition: "all .15s",
                  }}
                >
                  <input ref={fileRef} type="file" accept=".xlsx" style={{ display: "none" }} onChange={(e) => { setFile(e.target.files?.[0] || null); setError(""); }} />
                  {file ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: A.ink }}>{file.name}</p>
                      <p style={{ fontSize: 12, color: A.inkMuted }}>{(file.size / 1024).toFixed(1)} KB</p>
                      <button onClick={(e) => { e.stopPropagation(); setFile(null); }} style={{ marginTop: 6, fontSize: 12, color: A.blue, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>파일 변경</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,102,204,0.08)", border: `1px solid rgba(0,102,204,0.15)`, display: "flex", alignItems: "center", justifyContent: "center", color: A.blue }}>↑</div>
                      <p style={{ fontSize: 13, color: A.inkMuted }}>xlsx 파일을 드래그하거나 클릭해서 업로드</p>
                      <p style={{ fontSize: 11, color: "#9ca3af" }}>컬럼: 구분 · 테스트ID · 기능 · 시나리오 · 입력값/동작 · 기대결과</p>
                    </div>
                  )}
                  </div>
                </>
              )}

              {/* 자연어 입력 */}
              {mode === "natural" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {cards.map((card, idx) => (
                    <div key={card.id} style={{ borderRadius: 10, border: `1px solid ${A.hairline}`, background: A.canvas, overflow: "hidden", transition: "border-color .15s" }}
                      onFocusCapture={(e) => e.currentTarget.style.borderColor = A.blue}
                      onBlurCapture={(e) => e.currentTarget.style.borderColor = A.hairline}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px 6px", borderBottom: `1px solid ${A.divider}` }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: A.inkMuted }}>케이스 {idx + 1}</span>
                        {cards.length > 1 && (
                          <button onClick={() => removeCard(card.id)} style={{ background: "none", border: "none", cursor: "pointer", color: A.hairline, padding: 2, flexShrink: 0 }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = A.hairline)}
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 6v4M8.5 6v4M3 3.5l.7 7.2a.5.5 0 00.5.3h5.6a.5.5 0 00.5-.3L11 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        )}
                      </div>
                      <textarea
                        value={card.text}
                        onChange={(e) => handleScenarioChange(card.id, card.text, e.target.value)}
                        onKeyDown={(e) => handleScenarioKeyDown(card.id, e)}
                        placeholder={CARD_PLACEHOLDER} rows={6}
                        style={{ width: "100%", resize: "none", background: "transparent", padding: "8px 14px 12px", fontSize: 13, color: A.ink, outline: "none", border: "none", boxSizing: "border-box" }} />
                    </div>
                  ))}
                  <button onClick={addCard} style={{
                    width: "100%", borderRadius: 10, padding: "11px", fontSize: 13, color: A.blue, fontWeight: 500,
                    border: `1.5px dashed rgba(0,102,204,0.3)`, background: "transparent", cursor: "pointer", transition: "all .15s",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,102,204,0.04)"; e.currentTarget.style.borderColor = A.blue; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(0,102,204,0.3)"; }}
                  >
                    + 테스트 케이스 추가
                  </button>
                  <p style={{ fontSize: 11, color: A.inkMuted, display: "flex", gap: 5, alignItems: "flex-start" }}>
                    <span style={{ color: A.blue, flexShrink: 0, marginTop: 1 }}>i</span>
                    각 카드는 독립된 테스트 케이스로 실행됩니다. 로그인이 설정된 경우 모든 케이스 전에 자동 로그인합니다.
                  </p>
                </div>
              )}
            </div>

            {/* 오류 */}
            {error && (
              <div style={{ borderRadius: 10, background: "#fff5f5", border: "1px solid #fecaca", padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
                {error}
              </div>
            )}

            {/* 제출 버튼 */}
            <button
              onClick={handleSubmit}
              disabled={!isReady || isLoading}
              style={{
                width: "100%", borderRadius: 12, padding: "13px",
                fontSize: 14, fontWeight: 600, letterSpacing: "-0.2px",
                border: "none", cursor: isReady && !isLoading ? "pointer" : "not-allowed",
                background: isReady && !isLoading ? A.blue : A.parchment,
                color: isReady && !isLoading ? "#fff" : A.inkMuted,
                transition: "background .15s",
              }}
              onMouseEnter={(e) => { if (isReady && !isLoading) e.currentTarget.style.background = A.blueDark; }}
              onMouseLeave={(e) => { if (isReady && !isLoading) e.currentTarget.style.background = A.blue; }}
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

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN GATE MODAL — 새 테스트 생성(API 크레딧 소비) 보호용 2차 비밀번호
// ─────────────────────────────────────────────────────────────────────────────

function AdminGateModal({ onVerified }: { onVerified: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onVerified();
      } else {
        setError(data.error || "관리자 비밀번호가 올바르지 않습니다.");
      }
    } catch {
      setError("Worker에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div
        style={{
          background: A.canvas,
          borderRadius: 14,
          padding: "28px 28px 24px",
          width: 360,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <svg width="18" height="18" fill="none" stroke={A.blue} strokeWidth="1.8" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
            />
          </svg>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: A.ink }}>관리자 인증 필요</h2>
        </div>
        <p style={{ fontSize: 12.5, color: A.inkMuted, marginBottom: 16, lineHeight: 1.5 }}>
          새 테스트 실행은 AI API 비용이 발생하므로, 관리자 비밀번호 확인이 필요합니다.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            placeholder="관리자 비밀번호"
            style={{ ...inputStyle, marginBottom: 10 }}
          />
          {error && (
            <p style={{ fontSize: 12, color: "#dc2626", marginBottom: 10 }}>{error}</p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => router.push("/")}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${A.hairline}`,
                background: A.canvas, color: A.inkMuted, fontSize: 13.5, fontWeight: 500, cursor: "pointer",
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!password.trim() || loading}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                background: !password.trim() || loading ? A.parchment : A.blue,
                color: !password.trim() || loading ? A.inkMuted : "#fff",
                fontSize: 13.5, fontWeight: 600, cursor: !password.trim() || loading ? "not-allowed" : "pointer",
                transition: "background .15s",
              }}
            >
              {loading ? "확인 중…" : "확인"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
