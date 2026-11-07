import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { SubmitButton } from "@/components/submit-button";
import { Alert, inputClass, labelClass } from "@/components/ui";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/auth";
import { parseDashboardEnv } from "@/lib/env";

async function signIn(formData: FormData) {
  "use server";

  const { DASHBOARD_PASSWORD } = parseDashboardEnv(process.env);
  const password = String(formData.get("password") ?? "");
  if (!safeEqual(password, DASHBOARD_PASSWORD)) redirect("/login?error=1");

  (await cookies()).set(SESSION_COOKIE, sessionToken(DASHBOARD_PASSWORD), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
          <h1 className="text-xl font-semibold tracking-tight">Reverse Recruiting</h1>
        </div>
        <form action={signIn} className="space-y-4 rounded-md border border-line bg-surface p-5">
          {error && <Alert>Wrong password.</Alert>}
          <label className="block">
            <span className={labelClass}>Password</span>
            <input type="password" name="password" required autoFocus autoComplete="current-password" className={inputClass} />
          </label>
          <SubmitButton block pendingText="Signing in…">
            Sign in
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}
