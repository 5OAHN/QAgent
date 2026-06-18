import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QAgent",
  description: "AI Native QA Automation Pipeline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="h-screen bg-[#090909] text-white antialiased">{children}</body>
    </html>
  );
}
