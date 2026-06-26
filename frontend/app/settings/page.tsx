"use client";

import { useState, useEffect } from "react";

/* ─── 로컬스토리지 키 ────────────────────────────────────────── */
const KEYS = {
  workerUrl:  "qagent_worker_url",
  apiKey:     "qagent_api_key",
};

const DEFAULT_WORKER_URL = "http://localhost:8001";

/* ─── 공통 스타일 ────────────────────────────────────────────── */
const sectionCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e0e0e0",
  borderRadius: 16,
  overflow: "hidden",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 9,
  border: "1px solid rgba(209,213,219,0.8)",
  background: "rgba(255,255,255,0.8)",
  padding: "9px 13px",
  fontSize: 13,
  color: "#111827",
  outline: "none",
  transition: "border-color .15s, box-shadow .15s",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#6b7280",
  letterSpacing: "0.07em", textTransform: "uppercase",
  display: "block", marginBottom: 6,
};

export default function SettingsPage() {
  /* Worker URL */
  const [workerUrl, setWorkerUrl]   = useState(DEFAULT_WORKER_URL);
  const [urlStatus, setUrlStatus]   = useState<"idle" | "testing" | "ok" | "fail">("idle");

  /* API Key */
  const [apiKey, setApiKey]         = useState("");
  const [showKey, setShowKey]       = useState(false);

  /* Save feedback */
  const [saved, setSaved]           = useState(false);

  /* Password change */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [pwError, setPwError]                 = useState("");
  const [pwSuccess, setPwSuccess]             = useState(false);
  const [pwLoading, setPwLoading]             = useState(false);

  /* Load from localStorage */
  useEffect(() => {
    setWorkerUrl(localStorage.getItem(KEYS.workerUrl) || DEFAULT_WORKER_URL);
    setApiKey(localStorage.getItem(KEYS.apiKey) || "");
  }, []);

  /* Save all */
  const handleSave = () => {
    localStorage.setItem(KEYS.workerUrl, workerUrl.trim() || DEFAULT_WORKER_URL);
    localStorage.setItem(KEYS.apiKey, apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  /* Change app password */
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || pwLoading) return;
    setPwLoading(true); setPwError(""); setPwSuccess(false);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwSuccess(true);
        setCurrentPassword(""); setNewPassword("");
        setTimeout(() => setPwSuccess(false), 3000);
      } else {
        setPwError(data.error || "비밀번호 변경에 실패했습니다.");
      }
    } catch {
      setPwError("Worker에 연결할 수 없습니다.");
    } finally {
      setPwLoading(false);
    }
  };

  /* Test worker connection */
  const testConnection = async () => {
    setUrlStatus("testing");
    try {
      const res = await fetch(`${workerUrl.trim()}/health`, { signal: AbortSignal.timeout(4000) });
      setUrlStatus(res.ok ? "ok" : "fail");
    } catch {
      setUrlStatus("fail");
    }
    setTimeout(() => setUrlStatus("idle"), 4000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

      {/* 헤더 */}
      <header style={{
        background: "#ffffff",
        borderBottom: "1px solid #f0f0f0",
        padding: "0 28px",
        height: 54,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>QAgent</span>
          <span style={{ fontSize: 12, color: "#d1d5db" }}>/</span>
          <span style={{ fontSize: 12, color: "#0066cc", fontWeight: 600 }}>설정</span>
        </div>
        <button
          onClick={handleSave}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer",
            background: saved
              ? "rgba(22,163,74,0.9)"
              : "#0066cc",
            color: "#fff", fontSize: 13, fontWeight: 600,
            boxShadow: "0 2px 10px rgba(0,102,204,0.28)",
            transition: "all .2s",
          }}
        >
          {saved ? (
            <><svg width="13" height="13" fill="none"><path d="M2 7l3.5 3.5 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>저장됨</>
          ) : (
            "저장하기"
          )}
        </button>
      </header>

      {/* 본문 */}
      <main style={{ flex: 1, overflowY: "auto", padding: "28px 28px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 680, width: "100%" }}>

        {/* ── 1. 워커 서버 URL ─────────────────────────────── */}
        <section style={sectionCard}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(229,231,235,0.5)", background: "rgba(0,102,204,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(0,102,204,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="15" height="15" fill="none" stroke="#0066cc" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1d1d1f" }}>워커 서버 URL</p>
                <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>AI 테스트 에이전트가 실행되는 서버 주소</p>
              </div>
            </div>
          </div>
          <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={labelStyle}>Server URL</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="url" value={workerUrl}
                onChange={(e) => { setWorkerUrl(e.target.value); setUrlStatus("idle"); }}
                placeholder={DEFAULT_WORKER_URL}
                style={{ ...inputStyle, flex: 1 }}
                onFocus={(e) => { e.target.style.borderColor = "#0066cc"; e.target.style.boxShadow = "0 0 0 3px rgba(0,102,204,0.1)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(209,213,219,0.8)"; e.target.style.boxShadow = "none"; }}
              />
              <button
                onClick={testConnection}
                disabled={urlStatus === "testing"}
                style={{
                  padding: "9px 16px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: "1px solid rgba(209,213,219,0.8)", background: "rgba(255,255,255,0.8)",
                  color: urlStatus === "ok" ? "#16a34a" : urlStatus === "fail" ? "#dc2626" : "#0066cc",
                  whiteSpace: "nowrap", transition: "all .2s", flexShrink: 0,
                }}
              >
                {urlStatus === "testing" ? "확인 중…" : urlStatus === "ok" ? "✓ 연결됨" : urlStatus === "fail" ? "✗ 실패" : "연결 테스트"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#9ca3af" }}>
              기본값: <code style={{ background: "rgba(0,102,204,0.07)", padding: "1px 6px", borderRadius: 4, color: "#0066cc", fontSize: 11 }}>{DEFAULT_WORKER_URL}</code>
            </p>
          </div>
        </section>

        {/* ── 2. Anthropic API 키 ──────────────────────────── */}
        <section style={sectionCard}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(229,231,235,0.5)", background: "rgba(0,102,204,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(139,92,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="15" height="15" fill="none" stroke="#0066cc" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round"/></svg>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1d1d1f" }}>Anthropic API 키</p>
                <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Claude 모델을 호출하기 위한 인증 키</p>
              </div>
            </div>
          </div>
          <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={labelStyle}>API Key</label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-api03-…"
                  style={{ ...inputStyle, paddingRight: 40, fontFamily: apiKey && !showKey ? "monospace" : "inherit" }}
                  onFocus={(e) => { e.target.style.borderColor = "#0066cc"; e.target.style.boxShadow = "0 0 0 3px rgba(0,102,204,0.1)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(209,213,219,0.8)"; e.target.style.boxShadow = "none"; }}
                />
                <button
                  onClick={() => setShowKey((v) => !v)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 2 }}
                >
                  {showKey
                    ? <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><path d="M1 1l22 22" strokeLinecap="round"/></svg>
                    : <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
            </div>
            {apiKey && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                <svg width="12" height="12" fill="none" stroke="#16a34a" strokeWidth="1.8" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5"/><path d="M4 6l1.5 1.5 3-3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ color: "#16a34a" }}>키가 입력되었습니다</span>
                <span style={{ color: "#d1d5db" }}>— 브라우저 로컬스토리지에만 저장됩니다</span>
              </div>
            )}
            <p style={{ fontSize: 11, color: "#9ca3af" }}>
              API 키는 이 브라우저의 로컬스토리지에만 저장되며 외부로 전송되지 않습니다.
            </p>
          </div>
        </section>

        {/* ── 3. 접속 비밀번호 변경 ──────────────────────────── */}
        <section style={sectionCard}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(229,231,235,0.5)", background: "rgba(0,102,204,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(0,102,204,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="15" height="15" fill="none" stroke="#0066cc" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round"/><circle cx="12" cy="16" r="1.5"/></svg>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1d1d1f" }}>접속 비밀번호 변경</p>
                <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>QAgent 접속 시 사용하는 공유 비밀번호입니다</p>
              </div>
            </div>
          </div>
          <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={labelStyle}>현재 비밀번호</label>
              <input
                type="password" value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setPwError(""); }}
                placeholder="현재 비밀번호"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = "#0066cc"; e.target.style.boxShadow = "0 0 0 3px rgba(0,102,204,0.1)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(209,213,219,0.8)"; e.target.style.boxShadow = "none"; }}
              />
            </div>
            <div>
              <label style={labelStyle}>새 비밀번호</label>
              <input
                type="password" value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setPwError(""); }}
                placeholder="4자 이상 입력"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = "#0066cc"; e.target.style.boxShadow = "0 0 0 3px rgba(0,102,204,0.1)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(209,213,219,0.8)"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            {pwError && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#dc2626" }}>{pwError}</div>
            )}
            {pwSuccess && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#16a34a" }}>
                <svg width="12" height="12" fill="none" stroke="#16a34a" strokeWidth="1.8" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5"/><path d="M4 6l1.5 1.5 3-3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                비밀번호가 변경되었습니다
              </div>
            )}

            <button
              onClick={handleChangePassword}
              disabled={!currentPassword || !newPassword || pwLoading}
              style={{
                alignSelf: "flex-start", padding: "9px 16px", borderRadius: 9, fontSize: 12, fontWeight: 600,
                border: "none", cursor: currentPassword && newPassword && !pwLoading ? "pointer" : "not-allowed",
                background: currentPassword && newPassword && !pwLoading ? "#0066cc" : "#f5f5f7",
                color: currentPassword && newPassword && !pwLoading ? "#fff" : "#9ca3af",
              }}
            >
              {pwLoading ? "변경 중…" : "비밀번호 변경"}
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}
