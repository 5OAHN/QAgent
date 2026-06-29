"use client";

import { useState, useEffect, useCallback } from "react";

/* ─── 공통 스타일 ──────────────────────────────────────────────── */
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
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#6b7280",
  letterSpacing: "0.07em", textTransform: "uppercase" as const,
  display: "block", marginBottom: 6,
};

const sectionCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e0e0e0",
  borderRadius: 16,
  overflow: "hidden",
  flexShrink: 0,
};

/* ─── 토스트 ─────────────────────────────────────────────────────── */
type Toast = { id: number; message: string; type: "ok" | "err" | "warn" };

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  const bg = { ok: "#1a2e1a", err: "#2e1a1a", warn: "#2a2410" };
  const border = { ok: "#22c55e33", err: "#ef444433", warn: "#f59e0b44" };
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none",
      maxWidth: 420,
    }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "12px 18px", borderRadius: 12,
          background: bg[t.type], border: `1px solid ${border[t.type]}`,
          color: "#fff", fontSize: 13, fontWeight: 500, lineHeight: 1.5,
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          animation: "slideUp 0.22s ease",
        }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>
            {t.type === "ok" && <svg width="16" height="16" fill="none" stroke="#22c55e" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            {t.type === "err" && <svg width="16" height="16" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01" strokeLinecap="round"/></svg>}
            {t.type === "warn" && <svg width="16" height="16" fill="none" stroke="#f59e0b" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01" strokeLinecap="round"/></svg>}
          </span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = { n: 0 };
  const show = useCallback((message: string, type: "ok" | "err" | "warn" = "ok") => {
    const id = Date.now() + counter.n++;
    setToasts((prev) => [...prev, { id, message, type }]);
    const duration = type === "warn" ? 6000 : 3500;
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);
  return { toasts, show };
}

/* ─── 관리자 비밀번호 게이트 ───────────────────────────────────── */
function AdminGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (!password || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onUnlock();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "비밀번호가 올바르지 않습니다.");
        setPassword("");
      }
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#f9f9fb" }}>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{
        background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 20,
        padding: "40px 40px 36px", width: 360,
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
        display: "flex", flexDirection: "column", gap: 24,
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(0,102,204,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="26" height="26" fill="none" stroke="#0066cc" strokeWidth="1.6" viewBox="0 0 24 24">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round"/>
              <circle cx="12" cy="16" r="1.5" fill="#0066cc" stroke="none"/>
            </svg>
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#1d1d1f" }}>관리자 확인</p>
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>설정 메뉴 접근을 위해 관리자 비밀번호를 입력하세요</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="password" value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && verify()}
            placeholder="관리자 비밀번호"
            autoFocus
            style={{
              ...inputStyle, textAlign: "center", fontSize: 15, padding: "11px 16px",
              letterSpacing: password ? "0.25em" : "normal",
              borderColor: error ? "#dc2626" : "rgba(209,213,219,0.8)",
            }}
            onFocus={(e) => { e.target.style.borderColor = "#0066cc"; e.target.style.boxShadow = "0 0 0 3px rgba(0,102,204,0.1)"; }}
            onBlur={(e) => { e.target.style.borderColor = error ? "#dc2626" : "rgba(209,213,219,0.8)"; e.target.style.boxShadow = "none"; }}
          />
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#dc2626", fontSize: 12 }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01" strokeLinecap="round"/></svg>
              {error}
            </div>
          )}
          <button
            onClick={verify}
            disabled={!password || loading}
            style={{
              padding: "11px 0", borderRadius: 10, border: "none",
              background: password && !loading ? "#0066cc" : "#f0f0f5",
              color: password && !loading ? "#ffffff" : "#b0b0bc",
              fontSize: 14, fontWeight: 600,
              cursor: password && !loading ? "pointer" : "not-allowed",
              transition: "all .15s",
            }}
            onMouseEnter={(e) => { if (password && !loading) e.currentTarget.style.background = "#0055b3"; }}
            onMouseLeave={(e) => { if (password && !loading) e.currentTarget.style.background = "#0066cc"; }}
          >
            {loading ? "확인 중…" : "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── API 키 입력 행 ─────────────────────────────────────────────── */
type VerifyState = "idle" | "loading" | "ok" | "warn" | "err";

function ApiKeyRow({
  label, dot, placeholder, value, onChange,
  show, onToggle, onVerify, verifyState,
}: {
  label: string; dot: string; placeholder: string;
  value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void;
  onVerify: () => void; verifyState: VerifyState;
}) {
  const canVerify = value.trim().length > 8;
  const verifyColor = verifyState === "ok" ? "#16a34a" : verifyState === "warn" ? "#d97706" : verifyState === "err" ? "#dc2626" : "#0066cc";
  const verifyLabel = verifyState === "loading" ? "검증 중…" : verifyState === "ok" ? "✓ 정상" : verifyState === "warn" ? "⚠ 잔액부족" : verifyState === "err" ? "✗ 실패" : "검증";

  return (
    <div>
      <label style={labelStyle}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, display: "inline-block" }} />
          {label}
        </span>
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            style={{ ...inputStyle, paddingRight: 40, fontFamily: value && !show ? "monospace" : "inherit" }}
            onFocus={(e) => { e.target.style.borderColor = dot; e.target.style.boxShadow = `0 0 0 3px ${dot}22`; }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(209,213,219,0.8)"; e.target.style.boxShadow = "none"; }}
          />
          <button
            onClick={onToggle} type="button"
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 2 }}
          >
            {show
              ? <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><path d="M1 1l22 22" strokeLinecap="round"/></svg>
              : <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
          </button>
        </div>
        <button
          onClick={onVerify}
          disabled={!canVerify || verifyState === "loading"}
          style={{
            padding: "0 16px", height: 38, borderRadius: 9, fontSize: 12, fontWeight: 600,
            border: `1px solid ${canVerify ? verifyColor + "55" : "rgba(209,213,219,0.8)"}`,
            background: verifyState === "ok" ? "#f0fdf4" : verifyState === "warn" ? "#fffbeb" : verifyState === "err" ? "#fef2f2" : canVerify ? "rgba(255,255,255,0.9)" : "#f9f9fb",
            color: canVerify ? verifyColor : "#c0c0c8",
            cursor: canVerify && verifyState !== "loading" ? "pointer" : "not-allowed",
            whiteSpace: "nowrap" as const, flexShrink: 0, transition: "all .2s",
          }}
        >
          {verifyLabel}
        </button>
      </div>
    </div>
  );
}

/* ─── 메인 설정 페이지 ─────────────────────────────────────────── */
export default function SettingsPage() {
  const [unlocked, setUnlocked] = useState(false);
  const { toasts, show: showToast } = useToast();

  /* API 키 */
  const [anthropicKey, setAnthropicKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [anthropicVerify, setAnthropicVerify] = useState<VerifyState>("idle");
  const [geminiVerify, setGeminiVerify] = useState<VerifyState>("idle");

  const [apiKeyStatus, setApiKeyStatus] = useState({ hasAnthropic: false, hasGemini: false, anthropicMasked: "", geminiMasked: "" });
  const [apiKeySaving, setApiKeySaving] = useState(false);

  /* 비밀번호 변경 */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const loadApiKeyStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/api-keys");
      if (res.ok) {
        const data = await res.json();
        setApiKeyStatus({ hasAnthropic: data.hasAnthropic, hasGemini: data.hasGemini, anthropicMasked: data.anthropicApiKey || "", geminiMasked: data.geminiApiKey || "" });
      }
    } catch {}
  }, []);

  useEffect(() => { if (unlocked) loadApiKeyStatus(); }, [unlocked, loadApiKeyStatus]);

  /* 키 검증 */
  const verifyKey = async (provider: "claude" | "gemini", apiKey: string, setter: React.Dispatch<React.SetStateAction<VerifyState>>) => {
    if (!apiKey.trim()) return;
    setter("loading");
    try {
      const res = await fetch("/api/settings/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.warning) {
          // 키는 유효하지만 크레딧/quota 부족
          setter("ok");
          showToast(data.warning, "warn");
          setTimeout(() => setter("idle"), 6000);
        } else {
          setter("ok");
          showToast(data.message || `${provider === "claude" ? "Claude" : "Gemini"} API 키가 정상적으로 연결되었습니다`, "ok");
          setTimeout(() => setter("idle"), 4000);
        }
      } else {
        setter("err");
        showToast(data.error || "API 키 검증에 실패했습니다", "err");
        setTimeout(() => setter("idle"), 4000);
      }
    } catch {
      setter("err");
      showToast("Worker 서버에 연결할 수 없습니다", "err");
      setTimeout(() => setter("idle"), 4000);
    }
  };

  /* API 키 저장 */
  const handleSaveApiKeys = async () => {
    const body: Record<string, string> = {};
    if (anthropicKey.trim()) body.anthropicApiKey = anthropicKey.trim();
    if (geminiKey.trim()) body.geminiApiKey = geminiKey.trim();
    if (!Object.keys(body).length) return;

    setApiKeySaving(true);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setApiKeyStatus({ hasAnthropic: data.masked.hasAnthropic, hasGemini: data.masked.hasGemini, anthropicMasked: data.masked.anthropicApiKey || "", geminiMasked: data.masked.geminiApiKey || "" });
        setAnthropicKey(""); setGeminiKey("");
        showToast("API 키가 저장되었습니다", "ok");
      } else {
        showToast("저장에 실패했습니다. Worker 서버를 확인하세요.", "err");
      }
    } catch {
      showToast("Worker 서버에 연결할 수 없습니다", "err");
    } finally {
      setApiKeySaving(false);
    }
  };

  /* 비밀번호 변경 */
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !adminPassword || pwLoading) return;
    setPwLoading(true); setPwError(""); setPwSuccess(false);
    try {
      const verifyRes = await fetch("/api/auth/verify-admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      if (!verifyRes.ok) {
        const d = await verifyRes.json().catch(() => ({}));
        setPwError(d.error || "관리자 비밀번호가 올바르지 않습니다."); return;
      }
      const res = await fetch("/api/auth/change-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwSuccess(true);
        setCurrentPassword(""); setNewPassword(""); setAdminPassword("");
        setTimeout(() => setPwSuccess(false), 3000);
      } else {
        setPwError(data.error || "비밀번호 변경 실패");
      }
    } catch { setPwError("서버에 연결할 수 없습니다."); }
    finally { setPwLoading(false); }
  };

  if (!unlocked) return <AdminGate onUnlock={() => setUnlocked(true)} />;

  const canSaveKeys = !!(anthropicKey.trim() || geminiKey.trim());

  return (
    <>
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
      `}</style>
      <ToastContainer toasts={toasts} />

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        {/* 헤더 */}
        <header style={{ background: "#ffffff", borderBottom: "1px solid #f0f0f0", padding: "0 28px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>QAgent</span>
            <span style={{ fontSize: 12, color: "#d1d5db" }}>/</span>
            <span style={{ fontSize: 12, color: "#0066cc", fontWeight: 600 }}>설정</span>
          </div>
        </header>

        {/* 본문 — 스크롤 가능 */}
        <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px 40px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 660, width: "100%" }}>

          {/* ── API 키 관리 ─────────────────────────────────────── */}
          <section style={sectionCard}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(229,231,235,0.5)", background: "rgba(0,102,204,0.03)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(0,102,204,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="15" height="15" fill="none" stroke="#0066cc" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#1d1d1f" }}>AI API 키 관리</p>
                  <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Claude와 Gemini API 키를 등록하면 실제 AI 테스트 자동화에 사용됩니다</p>
                </div>
              </div>
            </div>

            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* 등록 상태 배지 */}
              <div style={{ display: "flex", gap: 10 }}>
                <ProviderBadge name="Claude" active={apiKeyStatus.hasAnthropic} masked={apiKeyStatus.anthropicMasked} color="#8b5cf6" />
                <ProviderBadge name="Gemini" active={apiKeyStatus.hasGemini} masked={apiKeyStatus.geminiMasked} color="#1a73e8" />
              </div>

              {/* Claude 키 입력 */}
              <ApiKeyRow
                label="Anthropic API Key (Claude)"
                dot="#8b5cf6"
                placeholder={apiKeyStatus.hasAnthropic ? `현재: ${apiKeyStatus.anthropicMasked}` : "sk-ant-api03-…"}
                value={anthropicKey}
                onChange={(v) => { setAnthropicKey(v); setAnthropicVerify("idle"); }}
                show={showAnthropic}
                onToggle={() => setShowAnthropic((v) => !v)}
                onVerify={() => verifyKey("claude", anthropicKey, setAnthropicVerify)}
                verifyState={anthropicVerify}
              />

              {/* Gemini 키 입력 */}
              <ApiKeyRow
                label="Google API Key (Gemini)"
                dot="#1a73e8"
                placeholder={apiKeyStatus.hasGemini ? `현재: ${apiKeyStatus.geminiMasked}` : "AIzaSy…"}
                value={geminiKey}
                onChange={(v) => { setGeminiKey(v); setGeminiVerify("idle"); }}
                show={showGemini}
                onToggle={() => setShowGemini((v) => !v)}
                onVerify={() => verifyKey("gemini", geminiKey, setGeminiVerify)}
                verifyState={geminiVerify}
              />

              {/* 안내 박스 */}
              <div style={{ background: "rgba(0,102,204,0.04)", border: "1px solid rgba(0,102,204,0.12)", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "#6b7280", lineHeight: 1.7 }}>
                <strong style={{ color: "#0066cc" }}>작동 방식:</strong> 두 키가 모두 등록되면 Claude 크레딧을 먼저 사용하고, 소진 시 자동으로 Gemini로 전환합니다.
              </div>

              {/* 저장 버튼 */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={handleSaveApiKeys}
                  disabled={!canSaveKeys || apiKeySaving}
                  style={{
                    padding: "9px 22px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                    border: "none",
                    background: canSaveKeys && !apiKeySaving ? "#0066cc" : "#f5f5f7",
                    color: canSaveKeys && !apiKeySaving ? "#fff" : "#9ca3af",
                    cursor: canSaveKeys && !apiKeySaving ? "pointer" : "not-allowed",
                    transition: "all .15s",
                  }}
                  onMouseEnter={(e) => { if (canSaveKeys && !apiKeySaving) e.currentTarget.style.background = "#0055b3"; }}
                  onMouseLeave={(e) => { if (canSaveKeys && !apiKeySaving) e.currentTarget.style.background = "#0066cc"; }}
                >
                  {apiKeySaving ? "저장 중…" : "API 키 저장"}
                </button>
              </div>
            </div>
          </section>

          {/* ── 접속 비밀번호 변경 ──────────────────────────────── */}
          <section style={sectionCard}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(229,231,235,0.5)", background: "rgba(0,102,204,0.03)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(0,102,204,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="15" height="15" fill="none" stroke="#0066cc" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round"/><circle cx="12" cy="16" r="1.5" fill="#0066cc" stroke="none"/></svg>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#1d1d1f" }}>접속 비밀번호 변경</p>
                  <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>QAgent 접속 시 사용하는 공유 비밀번호</p>
                </div>
              </div>
            </div>

            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>현재 비밀번호</label>
                <input type="password" value={currentPassword} onChange={(e) => { setCurrentPassword(e.target.value); setPwError(""); }} placeholder="현재 비밀번호" style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = "#0066cc"; e.target.style.boxShadow = "0 0 0 3px rgba(0,102,204,0.1)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(209,213,219,0.8)"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div>
                <label style={labelStyle}>새 비밀번호</label>
                <input type="password" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setPwError(""); }} placeholder="4자 이상 입력" style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = "#0066cc"; e.target.style.boxShadow = "0 0 0 3px rgba(0,102,204,0.1)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(209,213,219,0.8)"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div>
                <label style={labelStyle}>관리자 비밀번호 (2차 확인)</label>
                <input type="password" value={adminPassword} onChange={(e) => { setAdminPassword(e.target.value); setPwError(""); }} placeholder="관리자 비밀번호" style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = "#0066cc"; e.target.style.boxShadow = "0 0 0 3px rgba(0,102,204,0.1)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(209,213,219,0.8)"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              {pwError && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#dc2626" }}>
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01" strokeLinecap="round"/></svg>
                  {pwError}
                </div>
              )}
              {pwSuccess && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#16a34a" }}>
                  <svg width="12" height="12" fill="none" stroke="#16a34a" strokeWidth="1.8" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5"/><path d="M4 6l1.5 1.5 3-3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  비밀번호가 변경되었습니다
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={handleChangePassword}
                  disabled={!currentPassword || !newPassword || !adminPassword || pwLoading}
                  style={{
                    padding: "9px 22px", borderRadius: 9, fontSize: 13, fontWeight: 600, border: "none",
                    background: currentPassword && newPassword && adminPassword && !pwLoading ? "#0066cc" : "#f5f5f7",
                    color: currentPassword && newPassword && adminPassword && !pwLoading ? "#fff" : "#9ca3af",
                    cursor: currentPassword && newPassword && adminPassword && !pwLoading ? "pointer" : "not-allowed",
                  }}
                >
                  {pwLoading ? "변경 중…" : "비밀번호 변경"}
                </button>
              </div>
            </div>
          </section>

        </main>
      </div>
    </>
  );
}

/* ─── 보조 컴포넌트 ────────────────────────────────────────────── */
function ProviderBadge({ name, active, masked, color }: { name: string; active: boolean; masked: string; color: string }) {
  return (
    <div style={{
      flex: 1, padding: "10px 14px", borderRadius: 10,
      border: `1px solid ${active ? color + "33" : "#e5e7eb"}`,
      background: active ? color + "08" : "#fafafa",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: active ? "#16a34a" : "#d1d5db", display: "inline-block" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: active ? color : "#9ca3af" }}>{name}</span>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 20,
          background: active ? "#dcfce7" : "#f5f5f7",
          color: active ? "#16a34a" : "#9ca3af", marginLeft: "auto",
        }}>
          {active ? "등록됨" : "미등록"}
        </span>
      </div>
      {active && masked && (
        <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace", paddingLeft: 13 }}>{masked}</span>
      )}
    </div>
  );
}
