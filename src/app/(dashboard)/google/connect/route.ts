import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { CALLBACK_PATH, OAUTH_STATE_COOKIE, dashboardGoogle } from "@/lib/dashboard-google";
import { googleAuthUrl } from "@/lib/google";

export function GET(request: NextRequest) {
  const state = randomBytes(32).toString("hex");
  const redirectUri = new URL(CALLBACK_PATH, request.nextUrl.origin).toString();
  const response = NextResponse.redirect(googleAuthUrl(dashboardGoogle().clientId, redirectUri, state));
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: CALLBACK_PATH,
    maxAge: 10 * 60,
  });
  return response;
}
