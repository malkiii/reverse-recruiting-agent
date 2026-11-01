import { z } from "zod";
import type { ActorRun, ActorRunStatus, JobBoardGateway } from "./gateways";
import type { JobSearch } from "./schema";

const API_URL = "https://api.apify.com/v2";
const ACTOR = "valig/linkedin-jobs-scraper";
const SOURCE = "LinkedIn";
const PAST_24_HOURS = "r86400";

const STILL_RUNNING = ["READY", "RUNNING", "TIMING-OUT", "ABORTING"];

const itemSchema = z.object({
  url: z.string(),
  title: z.string(),
  companyName: z.string(),
  location: z.string().nullish(),
  postedDate: z.string(),
  description: z.string().nullish(),
  companyUrl: z.string().nullish(),
});

async function apify<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`Apify request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export const linkedInJobBoard: JobBoardGateway = {
  source: SOURCE,
  actor: ACTOR,

  async start({ keywords, location }: JobSearch, limit: number, token: string) {
    const { data } = await apify<{ data: { id: string } }>(`/acts/${ACTOR.replace("/", "~")}/runs`, token, {
      method: "POST",
      body: JSON.stringify({ keywords, location, datePosted: PAST_24_HOURS, limit }),
    });
    return data.id;
  },

  async status({ runId, token }: ActorRun): Promise<ActorRunStatus> {
    const { data } = await apify<{ data: { status: string } }>(`/actor-runs/${runId}`, token);
    if (STILL_RUNNING.includes(data.status)) return "running";
    return data.status === "SUCCEEDED" ? "succeeded" : "failed";
  },

  async results({ runId, token }: ActorRun) {
    const items = await apify<unknown[]>(`/actor-runs/${runId}/dataset/items?clean=true`, token);

    return items.flatMap((item) => {
      const parsed = itemSchema.safeParse(item);
      if (!parsed.success) {
        console.warn(`Skipped a malformed Job from actor run ${runId}`);
        return [];
      }
      const { url, title, companyName, location, postedDate, description, companyUrl } = parsed.data;
      return {
        source: SOURCE,
        title,
        companyName,
        location: location ?? "",
        url: url.split("?")[0],
        postDay: postedDate.slice(0, 10),
        description: description ?? null,
        companyLinkedinUrl: companyUrl ?? null,
      };
    });
  },
};
