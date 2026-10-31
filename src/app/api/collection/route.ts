import { safeEqual } from "@/lib/auth";
import { collectionServices } from "@/lib/collection";
import { env } from "@/lib/env";
import { runCollection } from "@/lib/job-collection";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!safeEqual(authorization, `Bearer ${env.CRON_SECRET}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  await runCollection(collectionServices());
  return new Response(null, { status: 204 });
}
