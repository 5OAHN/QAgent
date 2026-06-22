"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    label: "대시보드",
    href: "/",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    label: "새 테스트",
    href: "/new",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: "테스트 이력",
    href: "/history",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <path d="M9 12h6M9 16h4" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function GlobalNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  // RunDashboard 페이지에선 사이드바 숨김 (자체 레이아웃 사용)
  if (pathname.startsWith("/dashboard/")) return null;
  if (pathname === "/dashboard/demo") return null;

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: "#0d0d0d",
        borderRight: "1px solid #1a1a1a",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      {/* 로고 */}
      <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#0099ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: "-1px" }}>Q</span>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>QAgent</p>
            <p style={{ fontSize: 10, color: "#444", letterSpacing: "0.02em" }}>QA Automation</p>
          </div>
        </div>
      </div>

      {/* 메뉴 */}
      <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: "#333", letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px", marginBottom: 4 }}>메뉴</p>
        {NAV_ITEMS.map(({ label, href, icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? "#fff" : "#555",
                background: active ? "#1a1a1a" : "transparent",
                transition: "all .12s",
                position: "relative",
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#141414"; e.currentTarget.style.color = active ? "#fff" : "#999"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = active ? "#1a1a1a" : "transparent"; e.currentTarget.style.color = active ? "#fff" : "#555"; }}
            >
              {active && (
                <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 16, borderRadius: 999, background: "#0099ff" }} />
              )}
              <span style={{ color: active ? "#0099ff" : "inherit" }}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* 프로필 */}
      <div style={{ padding: "12px 10px", borderTop: "1px solid #1a1a1a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#0099ff" }}>안</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>안영선</p>
            <p style={{ fontSize: 10, color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Workspace</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
