import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "session";

const digest = (value: string) => createHash("sha256").update(value).digest();

export function safeEqual(a: string, b: string) {
  return timingSafeEqual(digest(a), digest(b));
}

export function sessionToken(password: string) {
  return createHmac("sha256", password).update("admin-session").digest("hex");
}
