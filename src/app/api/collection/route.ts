import { safeEqual } from "@/lib/auth";
import { env } from "@/lib/env";
import { runCollection } from "@/lib/job-collection";
import { drizzleJobStore } from "@/lib/drizzle";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!safeEqual(authorization, `Bearer ${env.CRON_SECRET}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  await runCollection({ jobBoards: [], jobs: drizzleJobStore() });
  return new Response(null, { status: 204 });
}
