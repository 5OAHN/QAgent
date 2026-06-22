"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    label: "새 테스트",
    href: "/new",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
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
  const [collapsed, setCollapsed] = useState(false);

  // RunDashboard 페이지에서는 자체 레이아웃 사용
  if (pathname.startsWith("/dashboard/")) return null;

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
        overflow: "hidden",
        // 글래스모피즘
        background: "rgba(255,255,255,0.45)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(255,255,255,0.65)",
        boxShadow: "4px 0 30px rgba(99,102,241,0.06)",
        zIndex: 10,
      }}
    >
      {/* 로고 + 토글 버튼 */}
      <div style={{
        padding: collapsed ? "18px 0" : "18px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        gap: 8,
        flexShrink: 0,
      }}>
        {/* 로고 마크 */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, overflow: "hidden" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
          }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: "-1px" }}>Q</span>
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b", letterSpacing: "-0.4px", lineHeight: 1.2, whiteSpace: "nowrap" }}>QAgent</p>
              <p style={{ fontSize: 10, color: "#a5b4fc", whiteSpace: "nowrap" }}>QA Automation</p>
            </div>
          )}
        </div>

        {/* 접기/펼치기 버튼 */}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            title="사이드바 접기"
            style={{
              width: 26, height: 26, borderRadius: 7, border: "1px solid rgba(99,102,241,0.15)",
              background: "rgba(99,102,241,0.05)", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#818cf8", flexShrink: 0, transition: "all .15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(99,102,241,0.12)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(99,102,241,0.05)"; }}
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 12 12">
              <path d="M8 2L4 6l4 4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            title="사이드바 펼치기"
            style={{
              position: "absolute", right: -12, top: 22,
              width: 24, height: 24, borderRadius: "50%",
              background: "rgba(255,255,255,0.9)", border: "1px solid rgba(99,102,241,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#818cf8", boxShadow: "0 2px 8px rgba(99,102,241,0.15)",
              transition: "all .15s", zIndex: 20,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#6366f1"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.9)"; e.currentTarget.style.color = "#818cf8"; }}
          >
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 12 12">
              <path d="M4 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* 메뉴 */}
      <nav style={{ flex: 1, padding: collapsed ? "12px 8px" : "12px 10px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {!collapsed && (
          <p style={{ fontSize: 10, fontWeight: 700, color: "#c7d2fe", letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 8px", marginBottom: 4 }}>메뉴</p>
        )}
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
                padding: collapsed ? "10px" : "9px 10px",
                borderRadius: 10,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? "#4338ca" : "#6b7280",
                background: active
                  ? "rgba(255,255,255,0.75)"
                  : "transparent",
                boxShadow: active ? "0 1px 8px rgba(99,102,241,0.12)" : "none",
                border: active ? "1px solid rgba(255,255,255,0.8)" : "1px solid transparent",
                transition: "all .15s",
                position: "relative",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.5)"; e.currentTarget.style.color = "#4338ca"; } }}
              onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6b7280"; } }}
            >
              {/* Active 인디케이터 */}
              {active && !collapsed && (
                <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 18, borderRadius: 999, background: "linear-gradient(to bottom, #6366f1, #8b5cf6)" }} />
              )}
              <span style={{ color: active ? "#6366f1" : "inherit", flexShrink: 0 }}>{icon}</span>
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* 하단 프로필 */}
      <div style={{ padding: collapsed ? "12px 8px" : "12px 10px", borderTop: "1px solid rgba(255,255,255,0.5)", flexShrink: 0 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: collapsed ? 0 : 9,
          justifyContent: collapsed ? "center" : "flex-start",
          padding: collapsed ? "8px" : "8px 10px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.4)",
          border: "1px solid rgba(255,255,255,0.6)",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg, #c7d2fe, #a5b4fc)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#4338ca" }}>안</span>
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#1e1b4b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>안영선</p>
              <p style={{ fontSize: 10, color: "#a5b4fc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Workspace</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
