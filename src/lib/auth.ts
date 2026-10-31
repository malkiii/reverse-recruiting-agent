import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export const SESSION_COOKIE = "session";

const digest = (value: string) => createHash("sha256").update(value).digest();

export function safeEqual(a: string, b: string) {
  return timingSafeEqual(digest(a), digest(b));
}

export function sessionToken() {
  return createHmac("sha256", env("DASHBOARD_PASSWORD")).update("admin-session").digest("hex");
}
