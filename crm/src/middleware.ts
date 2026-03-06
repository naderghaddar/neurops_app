import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { AUTH_SECRET } from "@/lib/auth-secret";

function buildLoginUrl(req: NextRequest): URL {
  const loginUrl = new URL("/login", req.url);
  const callbackPath = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  loginUrl.searchParams.set("callbackUrl", callbackPath);
  return loginUrl;
}

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: AUTH_SECRET });
  const path = req.nextUrl.pathname;
  const isDashboardRoute = path.startsWith("/dashboard");
  const isLoginRoute = path === "/login";

  if (isDashboardRoute && !token) {
    return NextResponse.redirect(buildLoginUrl(req));
  }

  if (isLoginRoute && token) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
