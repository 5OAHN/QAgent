"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const A = {
  blue: "#0066cc",
  blueDark: "#0055b3",
  ink: "#1d1d1f",
  inkMuted: "#6b7280",
  hairline: "#e0e0e0",
  canvas: "#ffffff",
  parchment: "#f5f5f7",
};

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isLoading) return;
    setIsLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(searchParams.get("next") || "/");
        router.refresh();
      } else {
        setError(data.error || "로그인에 실패했습니다.");
      }
    } catch {
      setError("Worker에 연결할 수 없습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: A.parchment }}>
      <form onSubmit={handleSubmit} style={{
        width: "100%", maxWidth: 360, background: A.canvas, border: `1px solid ${A.hairline}`,
        borderRadius: 18, padding: "32px 28px", display: "flex", flexDirection: "column", gap: 18,
      }}>
        <div style={{ textAlign: "center" }}>
          <img src="/logo.svg" alt="QAgent" style={{ height: 32, margin: "0 auto 12px" }} />
          <p style={{ fontSize: 13, color: A.inkMuted }}>비밀번호를 입력해 주세요</p>
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          placeholder="비밀번호"
          autoFocus
          style={{
            width: "100%", borderRadius: 10, border: `1px solid ${A.hairline}`,
            background: A.canvas, padding: "11px 14px", fontSize: 14, color: A.ink,
            outline: "none", boxSizing: "border-box",
          }}
          onFocus={(e) => { e.target.style.borderColor = A.blue; e.target.style.boxShadow = "0 0 0 3px rgba(0,102,204,0.1)"; }}
          onBlur={(e) => { e.target.style.borderColor = A.hairline; e.target.style.boxShadow = "none"; }}
        />

        {error && (
          <div style={{ borderRadius: 10, background: "#fff5f5", border: "1px solid #fecaca", padding: "9px 13px", fontSize: 13, color: "#dc2626" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!password || isLoading}
          style={{
            width: "100%", borderRadius: 12, padding: "12px",
            fontSize: 14, fontWeight: 600, border: "none",
            cursor: password && !isLoading ? "pointer" : "not-allowed",
            background: password && !isLoading ? A.blue : A.parchment,
            color: password && !isLoading ? "#fff" : A.inkMuted,
            transition: "background .15s",
          }}
          onMouseEnter={(e) => { if (password && !isLoading) e.currentTarget.style.background = A.blueDark; }}
          onMouseLeave={(e) => { if (password && !isLoading) e.currentTarget.style.background = A.blue; }}
        >
          {isLoading ? "확인 중…" : "들어가기"}
        </button>
      </form>
    </div>
  );
}
