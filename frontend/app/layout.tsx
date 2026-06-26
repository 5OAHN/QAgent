import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import GlobalNav from "@/components/GlobalNav";

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
