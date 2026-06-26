import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, signSession } from "@/lib/session";

const SESSION_SECRET = process.env.SESSION_SECRET || "";

export async function middleware(req: NextRequest) {
  // 시크릿이 설정되지 않으면 게이트를 비활성화 (로컬 개발 등)
  if (!SESSION_SECRET) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/logo.svg")
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const expected = await signSession(SESSION_SECRET);
  if (cookie === expected) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
