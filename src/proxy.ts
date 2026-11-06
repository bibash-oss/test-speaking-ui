import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 Proxy Convention (replaces middleware.ts).
 * Runs on server before route renders to check authentication for protected routes.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get("token")?.value;
  const hasToken = Boolean(token);

  // 1. Protected Recruiter Routes: require token
  const isProtectedRoute =
    pathname.startsWith("/company") || pathname === "/jobs" || pathname.startsWith("/jobs/");

  if (isProtectedRoute) {
    if (!hasToken) {
      const loginUrl = new URL("/login", request.url);
      const returnUrl = pathname + search;
      if (returnUrl && returnUrl !== "/company/jobs") {
        loginUrl.searchParams.set("returnUrl", returnUrl);
      }

      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Auth Pages: if recruiter already has a token, redirect to dashboard
  if (pathname === "/login") {
    if (hasToken) {
      const targetUrl = request.nextUrl.searchParams.get("returnUrl") || "/company/jobs";
      return NextResponse.redirect(new URL(targetUrl, request.url));
    }
  }

  return NextResponse.next();
}

/**
 * Matcher configuration for Proxy.
 * Only runs on recruiter/protected routes and login page, bypassing static assets and APIs.
 */
export const config = {
  matcher: [
    "/company/:path*",
    "/jobs/:path*",
    "/jobs",
    "/login",
  ],
};
