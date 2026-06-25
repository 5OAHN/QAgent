"use client";

import { useState, useEffect } from "react";

/* ─── 로컬스토리지 키 ────────────────────────────────────────── */
const KEYS = {
  workerUrl:  "qagent_worker_url",
  apiKey:     "qagent_api_key",
  members:    "qagent_team_members",
};

const DEFAULT_WORKER_URL = "http://localhost:8001";

const ROLE_OPTIONS = ["기획", "디자인", "프론트엔드", "백엔드", "QA", "DevOps", "PM"];

interface Member { id: string; name: string; role: string; }

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

  /* Team members */
  const [members, setMembers]       = useState<Member[]>([]);
  const [newName, setNewName]       = useState("");
  const [newRole, setNewRole]       = useState("프론트엔드");

  /* Save feedback */
  const [saved, setSaved]           = useState(false);

  /* Load from localStorage */
  useEffect(() => {
    setWorkerUrl(localStorage.getItem(KEYS.workerUrl) || DEFAULT_WORKER_URL);
    setApiKey(localStorage.getItem(KEYS.apiKey) || "");
    const raw = localStorage.getItem(KEYS.members);
    if (raw) { try { setMembers(JSON.parse(raw)); } catch {} }
  }, []);

  /* Save all */
  const handleSave = () => {
    localStorage.setItem(KEYS.workerUrl, workerUrl.trim() || DEFAULT_WORKER_URL);
    localStorage.setItem(KEYS.apiKey, apiKey.trim());
    localStorage.setItem(KEYS.members, JSON.stringify(members));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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

  /* Add member */
  const addMember = () => {
    if (!newName.trim()) return;
    const m: Member = { id: crypto.randomUUID(), name: newName.trim(), role: newRole };
    setMembers((p) => [...p, m]);
    setNewName("");
  };
  const removeMember = (id: string) => setMembers((p) => p.filter((m) => m.id !== id));

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

        {/* ── 3. 팀 멤버 ───────────────────────────────────── */}
        <section style={sectionCard}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(229,231,235,0.5)", background: "rgba(0,102,204,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(16,163,74,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="15" height="15" fill="none" stroke="#16a34a" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1d1d1f" }}>팀 멤버 관리</p>
                <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>새 테스트 실행 시 실행자 목록에 표시됩니다</p>
              </div>
            </div>
          </div>

          {/* 멤버 추가 */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(229,231,235,0.4)" }}>
            <label style={labelStyle}>멤버 추가</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text" value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMember()}
                placeholder="이름 입력"
                style={{ ...inputStyle, flex: 1 }}
                onFocus={(e) => { e.target.style.borderColor = "#0066cc"; e.target.style.boxShadow = "0 0 0 3px rgba(0,102,204,0.1)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(209,213,219,0.8)"; e.target.style.boxShadow = "none"; }}
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                style={{ ...inputStyle, width: "auto", paddingRight: 28, cursor: "pointer" }}
              >
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button
                onClick={addMember}
                style={{
                  padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: "none", background: "#0066cc", color: "#fff",
                  boxShadow: "0 2px 8px rgba(0,102,204,0.25)", whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                + 추가
              </button>
            </div>
          </div>

          {/* 멤버 목록 */}
          <div style={{ padding: "10px 16px 14px" }}>
            {members.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center" }}>
                <p style={{ fontSize: 12, color: "#d1d5db" }}>등록된 팀 멤버가 없습니다</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {members.map((m) => (
                  <div key={m.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "9px 13px", borderRadius: 9,
                    background: "rgba(255,255,255,0.7)", border: "1px solid rgba(229,231,235,0.6)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e8f0fc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#0066cc" }}>{m.name[0]}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{m.name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "#0066cc", background: "rgba(0,102,204,0.08)", padding: "2px 9px", borderRadius: 99, fontWeight: 500, border: "1px solid rgba(0,102,204,0.15)" }}>{m.role}</span>
                      <button
                        onClick={() => removeMember(m.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", padding: 2, borderRadius: 5, transition: "color .15s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#d1d5db")}
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
