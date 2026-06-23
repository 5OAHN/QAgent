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
        background: "#f5f5f7",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        color: "#1d1d1f",
      }}>
        <div className="flex h-full">
          <GlobalNav />
          <div className="flex flex-col flex-1 min-w-0 overflow-auto">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
