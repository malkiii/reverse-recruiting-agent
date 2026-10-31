import { safeEqual } from "@/lib/auth";
import { collectionServices } from "@/lib/collection";
import { env } from "@/lib/env";
import { resumeCollection } from "@/lib/job-collection";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!safeEqual(String(body?.secret ?? ""), env.APIFY_WEBHOOK_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  await resumeCollection({ ...collectionServices(), runId: String(body?.resource?.id) });
  return new Response(null, { status: 204 });
}
