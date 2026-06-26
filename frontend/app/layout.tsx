import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "QAgent",
  description: "AI Native QA Automation Pipeline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={outfit.variable}>
      <body className="h-screen overflow-hidden antialiased" style={{
        background: "#f5f5f7",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Pretendard', sans-serif",
      }}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
