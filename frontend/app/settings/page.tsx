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
};

function SectionHeader({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(229,231,235,0.5)", background: "rgba(0,102,204,0.03)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(0,102,204,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#1d1d1f" }}>{title}</p>
          <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{desc}</p>
        </div>
      </div>
    </div>
  );
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
    <div style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f9f9fb",
    }}>
      <div style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        padding: "40px 40px 36px",
        width: 360,
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}>
        {/* 아이콘 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: "rgba(0,102,204,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
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

        {/* 입력 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && verify()}
            placeholder="관리자 비밀번호"
            autoFocus
            style={{
              ...inputStyle,
              textAlign: "center",
              letterSpacing: password ? "0.25em" : "normal",
              fontSize: 15,
              padding: "11px 16px",
            }}
            onFocus={(e) => { e.target.style.borderColor = "#0066cc"; e.target.style.boxShadow = "0 0 0 3px rgba(0,102,204,0.1)"; }}
            onBlur={(e) => { e.target.style.borderColor = error ? "#dc2626" : "rgba(209,213,219,0.8)"; e.target.style.boxShadow = "none"; }}
          />

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#dc2626", fontSize: 12 }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01" strokeLinecap="round"/>
              </svg>
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
              fontSize: 14, fontWeight: 600, cursor: password && !loading ? "pointer" : "not-allowed",
              transition: "all .15s",
            }}
            onMouseEnter={(e) => { if (password && !loading) e.currentTarget.style.background = "#0055b3"; }}
            onMouseLeave={(e) => { if (password && !loading) e.currentTarget.style.background = "#0066cc"; }}
          >
            {loading ? "확인 중…" : "확인"}
          </button>
        </div>

        <p style={{ fontSize: 11, color: "#c0c0c8", textAlign: "center", marginTop: -8 }}>
          기본 관리자 비밀번호: <code style={{ background: "#f5f5f7", padding: "1px 6px", borderRadius: 4 }}>qagent-admin</code>
        </p>
      </div>
    </div>
  );
}

/* ─── 메인 설정 페이지 ─────────────────────────────────────────── */
const DEFAULT_WORKER_URL = "http://localhost:8001";
const LS_WORKER_URL = "qagent_worker_url";

export default function SettingsPage() {
  const [unlocked, setUnlocked] = useState(false);

  /* Worker URL */
  const [workerUrl, setWorkerUrl] = useState(DEFAULT_WORKER_URL);
  const [urlStatus, setUrlStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");

  /* API 키 */
  const [anthropicKey, setAnthropicKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<{ hasAnthropic: boolean; hasGemini: boolean; anthropicMasked: string; geminiMasked: string }>({
    hasAnthropic: false, hasGemini: false, anthropicMasked: "", geminiMasked: "",
  });
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState<"" | "ok" | "err">("");

  /* 비밀번호 변경 */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  /* 저장 피드백 */
  const [saved, setSaved] = useState(false);

  /* 언락 후 초기 데이터 로드 */
  const loadData = useCallback(async () => {
    setWorkerUrl(localStorage.getItem(LS_WORKER_URL) || DEFAULT_WORKER_URL);
    try {
      const res = await fetch("/api/settings/api-keys");
      if (res.ok) {
        const data = await res.json();
        setApiKeyStatus({
          hasAnthropic: data.hasAnthropic,
          hasGemini: data.hasGemini,
          anthropicMasked: data.anthropicApiKey || "",
          geminiMasked: data.geminiApiKey || "",
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (unlocked) loadData();
  }, [unlocked, loadData]);

  /* URL 저장 */
  const handleSave = () => {
    localStorage.setItem(LS_WORKER_URL, workerUrl.trim() || DEFAULT_WORKER_URL);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  /* 연결 테스트 */
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

  /* API 키 저장 */
  const handleSaveApiKeys = async () => {
    setApiKeySaving(true);
    setApiKeySaved("");
    try {
      const body: Record<string, string> = {};
      if (anthropicKey.trim()) body.anthropicApiKey = anthropicKey.trim();
      if (geminiKey.trim()) body.geminiApiKey = geminiKey.trim();

      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setApiKeyStatus({
          hasAnthropic: data.masked.hasAnthropic,
          hasGemini: data.masked.hasGemini,
          anthropicMasked: data.masked.anthropicApiKey || "",
          geminiMasked: data.masked.geminiApiKey || "",
        });
        setAnthropicKey("");
        setGeminiKey("");
        setApiKeySaved("ok");
      } else {
        setApiKeySaved("err");
      }
    } catch {
      setApiKeySaved("err");
    } finally {
      setApiKeySaving(false);
      setTimeout(() => setApiKeySaved(""), 3000);
    }
  };

  /* 비밀번호 변경 */
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !adminPassword || pwLoading) return;
    setPwLoading(true); setPwError(""); setPwSuccess(false);
    try {
      const verifyRes = await fetch("/api/auth/verify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      if (!verifyRes.ok) {
        const d = await verifyRes.json().catch(() => ({}));
        setPwError(d.error || "관리자 비밀번호가 올바르지 않습니다.");
        return;
      }
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    } catch {
      setPwError("서버에 연결할 수 없습니다.");
    } finally {
      setPwLoading(false);
    }
  };

  if (!unlocked) return <AdminGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

      {/* 헤더 */}
      <header style={{
        background: "#ffffff", borderBottom: "1px solid #f0f0f0",
        padding: "0 28px", height: 54,
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
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
            background: saved ? "rgba(22,163,74,0.9)" : "#0066cc",
            color: "#fff", fontSize: 13, fontWeight: 600,
            boxShadow: "0 2px 10px rgba(0,102,204,0.28)", transition: "all .2s",
          }}
        >
          {saved
            ? <><svg width="13" height="13" fill="none"><path d="M2 7l3.5 3.5 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>저장됨</>
            : "저장하기"}
        </button>
      </header>

      {/* 본문 */}
      <main style={{ flex: 1, overflowY: "auto", padding: "28px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 680, width: "100%" }}>

        {/* ── 1. 워커 서버 URL ─────────────────────────────── */}
        <section style={sectionCard}>
          <SectionHeader
            icon={<svg width="15" height="15" fill="none" stroke="#0066cc" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>}
            title="워커 서버 URL"
            desc="AI 테스트 에이전트가 실행되는 서버 주소"
          />
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

        {/* ── 2. AI API 키 관리 ────────────────────────────── */}
        <section style={sectionCard}>
          <SectionHeader
            icon={<svg width="15" height="15" fill="none" stroke="#0066cc" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>}
            title="AI API 키 관리"
            desc="Claude와 Gemini API 키를 등록하면 실제 AI 테스트 자동화에 사용됩니다"
          />
          <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 18 }}>

            {/* 현재 등록 상태 */}
            <div style={{ display: "flex", gap: 10 }}>
              <ProviderBadge
                name="Claude"
                active={apiKeyStatus.hasAnthropic}
                masked={apiKeyStatus.anthropicMasked}
                color="#8b5cf6"
              />
              <ProviderBadge
                name="Gemini"
                active={apiKeyStatus.hasGemini}
                masked={apiKeyStatus.geminiMasked}
                color="#1a73e8"
              />
            </div>

            {/* Claude API 키 */}
            <div>
              <label style={labelStyle}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#8b5cf6", display: "inline-block" }} />
                  Anthropic API Key (Claude)
                </span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showAnthropic ? "text" : "password"}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder={apiKeyStatus.hasAnthropic ? `현재: ${apiKeyStatus.anthropicMasked}  (새 키를 입력하면 교체됩니다)` : "sk-ant-api03-…"}
                  style={{ ...inputStyle, paddingRight: 40, fontFamily: anthropicKey && !showAnthropic ? "monospace" : "inherit" }}
                  onFocus={(e) => { e.target.style.borderColor = "#8b5cf6"; e.target.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.1)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(209,213,219,0.8)"; e.target.style.boxShadow = "none"; }}
                />
                <EyeButton show={showAnthropic} onToggle={() => setShowAnthropic(v => !v)} />
              </div>
            </div>

            {/* Gemini API 키 */}
            <div>
              <label style={labelStyle}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1a73e8", display: "inline-block" }} />
                  Google API Key (Gemini)
                </span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showGemini ? "text" : "password"}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder={apiKeyStatus.hasGemini ? `현재: ${apiKeyStatus.geminiMasked}  (새 키를 입력하면 교체됩니다)` : "AIzaSy…"}
                  style={{ ...inputStyle, paddingRight: 40, fontFamily: geminiKey && !showGemini ? "monospace" : "inherit" }}
                  onFocus={(e) => { e.target.style.borderColor = "#1a73e8"; e.target.style.boxShadow = "0 0 0 3px rgba(26,115,232,0.1)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(209,213,219,0.8)"; e.target.style.boxShadow = "none"; }}
                />
                <EyeButton show={showGemini} onToggle={() => setShowGemini(v => !v)} />
              </div>
            </div>

            {/* 안내 */}
            <div style={{ background: "rgba(0,102,204,0.04)", border: "1px solid rgba(0,102,204,0.12)", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "#6b7280", lineHeight: 1.7 }}>
              <strong style={{ color: "#0066cc" }}>작동 방식:</strong> 두 키가 모두 등록되면 Claude 크레딧을 먼저 사용하고, 소진 시 자동으로 Gemini로 전환합니다.<br/>
              키는 워커 서버의 <code style={{ background: "rgba(0,0,0,0.06)", padding: "1px 5px", borderRadius: 3 }}>data/api-keys.json</code>에 암호화 없이 저장됩니다. 운영 환경에서는 환경변수 사용을 권장합니다.
            </div>

            {/* 피드백 */}
            {apiKeySaved === "ok" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#16a34a" }}>
                <svg width="13" height="13" fill="none" stroke="#16a34a" strokeWidth="1.8" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5"/><path d="M4 6l1.5 1.5 3-3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                API 키가 저장되었습니다
              </div>
            )}
            {apiKeySaved === "err" && (
              <div style={{ fontSize: 12, color: "#dc2626" }}>저장에 실패했습니다. Worker 서버 연결을 확인하세요.</div>
            )}

            <button
              onClick={handleSaveApiKeys}
              disabled={(!anthropicKey.trim() && !geminiKey.trim()) || apiKeySaving}
              style={{
                alignSelf: "flex-start", padding: "9px 20px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                border: "none",
                background: (anthropicKey.trim() || geminiKey.trim()) && !apiKeySaving ? "#0066cc" : "#f5f5f7",
                color: (anthropicKey.trim() || geminiKey.trim()) && !apiKeySaving ? "#fff" : "#9ca3af",
                cursor: (anthropicKey.trim() || geminiKey.trim()) && !apiKeySaving ? "pointer" : "not-allowed",
                transition: "all .15s",
              }}
              onMouseEnter={(e) => { if ((anthropicKey.trim() || geminiKey.trim()) && !apiKeySaving) e.currentTarget.style.background = "#0055b3"; }}
              onMouseLeave={(e) => { if ((anthropicKey.trim() || geminiKey.trim()) && !apiKeySaving) e.currentTarget.style.background = "#0066cc"; }}
            >
              {apiKeySaving ? "저장 중…" : "API 키 저장"}
            </button>
          </div>
        </section>

        {/* ── 3. 접속 비밀번호 변경 ──────────────────────────── */}
        <section style={sectionCard}>
          <SectionHeader
            icon={<svg width="15" height="15" fill="none" stroke="#0066cc" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round"/><circle cx="12" cy="16" r="1.5" fill="#0066cc" stroke="none"/></svg>}
            title="접속 비밀번호 변경"
            desc="QAgent 접속 시 사용하는 공유 비밀번호"
          />
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
            <div>
              <label style={labelStyle}>관리자 비밀번호 (2차 확인)</label>
              <input
                type="password" value={adminPassword}
                onChange={(e) => { setAdminPassword(e.target.value); setPwError(""); }}
                placeholder="관리자 비밀번호"
                style={inputStyle}
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

            <button
              onClick={handleChangePassword}
              disabled={!currentPassword || !newPassword || !adminPassword || pwLoading}
              style={{
                alignSelf: "flex-start", padding: "9px 16px", borderRadius: 9, fontSize: 12, fontWeight: 600,
                border: "none",
                background: currentPassword && newPassword && adminPassword && !pwLoading ? "#0066cc" : "#f5f5f7",
                color: currentPassword && newPassword && adminPassword && !pwLoading ? "#fff" : "#9ca3af",
                cursor: currentPassword && newPassword && adminPassword && !pwLoading ? "pointer" : "not-allowed",
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
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: active ? "#16a34a" : "#d1d5db",
          display: "inline-block",
        }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: active ? color : "#9ca3af" }}>{name}</span>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 20,
          background: active ? "#dcfce7" : "#f5f5f7",
          color: active ? "#16a34a" : "#9ca3af",
          marginLeft: "auto",
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

function EyeButton({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      type="button"
      style={{
        position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
        background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 2,
      }}
    >
      {show
        ? <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><path d="M1 1l22 22" strokeLinecap="round"/></svg>
        : <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
    </button>
  );
}
