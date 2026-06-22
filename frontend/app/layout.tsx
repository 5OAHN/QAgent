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
      <body className="h-screen bg-[#090909] text-white antialiased flex overflow-hidden">
        <GlobalNav />
        <div className="flex flex-col flex-1 min-w-0 overflow-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
