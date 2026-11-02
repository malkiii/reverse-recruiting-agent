import { z } from "zod";
import type { ActorRun, ActorRunStatus, JobBoardGateway } from "./gateways";
import type { JobSearch } from "./schema";

const API_URL = "https://api.apify.com/v2";
const ACTOR = "worldunboxer/rapid-linkedin-scraper";
const SOURCE = "LinkedIn";
const PAST_24_HOURS = "Past 24 hours";
// The actor rejects smaller runs. Job Collection still saves at most its cap.
const MIN_JOBS_PER_RUN = 10;

const STILL_RUNNING = ["READY", "RUNNING", "TIMING-OUT", "ABORTING"];

const itemSchema = z.object({
  job_url: z.string(),
  job_title: z.string(),
  company_name: z.string(),
  location: z.string().nullish(),
  posted_date: z.string(),
  job_description: z.string().nullish(),
  company_url: z.string().nullish(),
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
      body: JSON.stringify({
        jobs_titles: [keywords],
        location,
        posted_within: PAST_24_HOURS,
        jobs_entries: Math.max(limit, MIN_JOBS_PER_RUN),
      }),
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
      const { job_url, job_title, company_name, location, posted_date, job_description, company_url } = parsed.data;
      return {
        source: SOURCE,
        title: job_title,
        companyName: company_name,
        location: location ?? "",
        url: job_url.split("?")[0],
        postDay: posted_date.slice(0, 10),
        description: job_description ?? null,
        companyLinkedinUrl: company_url ?? null,
      };
    });
  },
};
