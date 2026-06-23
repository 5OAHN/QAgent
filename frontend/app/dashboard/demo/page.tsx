"use client";

import Link from "next/link";
import { RunDashboard } from "@/components/RunDashboard";

export default function DemoPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* 데모 배너 */}
      <div style={{
        flexShrink: 0,
        background: "#eff6ff",
        borderBottom: "1px solid #bfdbfe",
        padding: "7px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 50,
      }}>
        <span style={{ fontSize: 12, color: "#0066cc", fontWeight: 400 }}>
          👁 데모 모드 — 실제 테스트가 아닌 시뮬레이션입니다
        </span>
        <Link href="/new" style={{ fontSize: 11, color: "#9ca3af", textDecoration: "none" }}>
          실제 테스트 시작 →
        </Link>
      </div>

      {/* RunDashboard — demo runId는 API에서 mock 데이터 반환 */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <RunDashboard runId="demo" />
      </div>
    </div>
  );
}
