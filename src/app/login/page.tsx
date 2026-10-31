import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/auth";
import { env } from "@/lib/env";

async function signIn(formData: FormData) {
  "use server";

  const password = String(formData.get("password") ?? "");
  if (!safeEqual(password, env.DASHBOARD_PASSWORD)) redirect("/login?error=1");

  (await cookies()).set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/jobs");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main>
      <h1>Sign in</h1>
      {error && <p role="alert">Wrong password.</p>}
      <form action={signIn}>
        <label>
          Password <input type="password" name="password" required autoFocus />
        </label>
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}
