import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/auth";
import { parseDashboardEnv } from "@/lib/env";

export function proxy(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const { DASHBOARD_PASSWORD } = parseDashboardEnv(process.env);
  if (safeEqual(session, sessionToken(DASHBOARD_PASSWORD))) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!login$|_next/static/|_next/image$|favicon\\.ico$).*)"],
};
