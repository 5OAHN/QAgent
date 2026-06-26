"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  {
    label: "대시보드",
    href: "/",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    label: "테스트 이력",
    href: "/history",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <path d="M9 12h6M9 16h4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: "설정",
    href: "/settings",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
  },
];

export default function GlobalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      style={{
        width: collapsed ? 64 : 220,
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
        display: "flex",
        flexDirection: "column",
        transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
        overflow: "visible",
        background: "#ffffff",
        borderRight: "1px solid #e0e0e0",
        zIndex: 10,
      }}
    >
      {/* 로고 + 접기 버튼 */}
      <div style={{
        padding: collapsed ? "14px 0" : "14px 16px",
        borderBottom: "1px solid #f0f0f0",
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        flexShrink: 0,
        height: 56,
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, overflow: "hidden" }}>
          <img src="/logo.svg" alt="QAgent" style={{ height: 24, width: "auto", flexShrink: 0 }} />
          {!collapsed && (
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              <p style={{ fontSize: 18, fontWeight: 600, color: "#1d1d1f", letterSpacing: "-0.4px", lineHeight: 1.2, whiteSpace: "nowrap", fontFamily: "var(--font-outfit), sans-serif" }}>QAgent</p>
            </div>
          )}
        </div>

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            title="접기"
            style={{
              width: 24, height: 24, borderRadius: 6, border: "1px solid #e0e0e0",
              background: "transparent", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#6b7280", flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f5f5f7"; e.currentTarget.style.color = "#1d1d1f"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6b7280"; }}
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 12 12">
              <path d="M8 2L4 6l4 4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* 새 테스트 버튼 */}
      <div style={{ padding: collapsed ? "10px 8px" : "10px 10px", borderBottom: "1px solid #f0f0f0", flexShrink: 0 }}>
        <Link
          href="/new"
          title={collapsed ? "새 테스트" : undefined}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 7,
            padding: collapsed ? "9px" : "9px 12px",
            borderRadius: 8,
            background: "#0066cc",
            color: "#ffffff",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            transition: "background .12s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#0055b3"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#0066cc"; }}
        >
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
          </svg>
          {!collapsed && "새 테스트"}
        </Link>
      </div>

      {/* 메뉴 */}
      <nav style={{ flex: 1, padding: collapsed ? "10px 6px" : "10px 10px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", overflowX: "hidden" }}>
        {NAV_ITEMS.map(({ label, href, icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: collapsed ? 0 : 10,
                justifyContent: collapsed ? "center" : "flex-start",
                padding: collapsed ? "9px" : "9px 10px",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                color: active ? "#0066cc" : "#1d1d1f",
                background: active ? "#f0f7ff" : "transparent",
                transition: "background .12s, color .12s",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "#f5f5f7"; } }}
              onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; } }}
            >
              <span style={{ color: active ? "#0066cc" : "#6b7280", flexShrink: 0 }}>{icon}</span>
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* 펼치기 버튼 (접힌 상태) */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          title="펼치기"
          style={{
            position: "absolute", right: -16, top: 16,
            width: 32, height: 32, borderRadius: "50%",
            background: "#0066cc", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#ffffff",
            boxShadow: "0 2px 8px rgba(0,102,204,0.35)",
            zIndex: 20,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#0055b3"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#0066cc"; }}
        >
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 12 12">
            <path d="M4 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {/* 하단 프로필 */}
      <div style={{ padding: collapsed ? "10px 6px" : "10px 10px", borderTop: "1px solid #f0f0f0", flexShrink: 0 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: collapsed ? 0 : 9,
          justifyContent: collapsed ? "center" : "flex-start",
          padding: collapsed ? "7px" : "7px 10px",
          borderRadius: 8,
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            background: "#e8f0fc",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#0066cc" }}>안</span>
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "#1d1d1f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>안영선</p>
              <p style={{ fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Workspace</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleLogout}
              title="로그아웃"
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 4, flexShrink: 0, borderRadius: 6 }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#9ca3af"; e.currentTarget.style.background = "transparent"; }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
