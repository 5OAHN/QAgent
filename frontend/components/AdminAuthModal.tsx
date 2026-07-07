"use client";

import { useState } from "react";

// 관리자 인증 모달 — 성공 시 워커가 발급한 토큰을 콜백으로 전달.
// 토큰은 호출 측에서 lib/admin.ts의 setAdminToken으로 저장한다.
export default function AdminAuthModal({
  onVerified,
  onClose,
}: {
  onVerified: (token: string) => void;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      if (res.ok && data.ok) onVerified(data.adminToken || "");
      else setError(data.error || "관리자 비밀번호가 올바르지 않습니다.");
    } catch {
      setError("Worker에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 14, padding: "28px 28px 24px", width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1d1d1f", marginBottom: 6 }}>🔑 관리자 인증 필요</h2>
        <p style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 16, lineHeight: 1.5 }}>
          테스트 실행은 AI API 비용이 발생합니다. 한 번 인증하면 이 브라우저에서는 다시 묻지 않습니다.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            placeholder="관리자 비밀번호"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e0e0e0", fontSize: 14, outline: "none", marginBottom: 10, boxSizing: "border-box" }}
          />
          {error && <p style={{ fontSize: 12, color: "#dc2626", marginBottom: 10 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid #e0e0e0", background: "#fff", color: "#6b7280", fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!password.trim() || loading}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                background: !password.trim() || loading ? "#f5f5f7" : "#0066cc",
                color: !password.trim() || loading ? "#6b7280" : "#fff",
                fontSize: 13.5, fontWeight: 600,
                cursor: !password.trim() || loading ? "not-allowed" : "pointer",
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
