"use client";

import { usePathname } from "next/navigation";
import GlobalNav from "@/components/GlobalNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/login")) return <>{children}</>;

  return (
    <div className="flex h-full">
      <GlobalNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-auto">
        {children}
      </div>
    </div>
  );
}
