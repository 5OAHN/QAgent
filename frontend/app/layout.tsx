import type { Metadata } from "next";
import "./globals.css";
import GlobalNav from "@/components/GlobalNav";

export const metadata: Metadata = {
  title: "QAgent",
  description: "AI Native QA Automation Pipeline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="h-screen overflow-hidden antialiased" style={{
        background: "linear-gradient(135deg, #eef2ff 0%, #f8faff 40%, #faf5ff 70%, #f0f4ff 100%)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Geist', 'Pretendard', sans-serif",
      }}>
        {/* 배경 메쉬 블롭 */}
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
          <div style={{ position: "absolute", top: "-20%", left: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(129,140,248,0.12) 0%, transparent 70%)" }} />
          <div style={{ position: "absolute", bottom: "-10%", right: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.10) 0%, transparent 70%)" }} />
          <div style={{ position: "absolute", top: "40%", right: "25%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)" }} />
        </div>

        <div className="relative flex h-full" style={{ zIndex: 1 }}>
          <GlobalNav />
          <div className="flex flex-col flex-1 min-w-0 overflow-auto">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
