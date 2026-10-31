import { env } from "./env";
import { JOBS_PER_RUN } from "./gateways";
import type { ActorRun, JobBoardGateway, JobBoardSettings } from "./gateways";

const API_URL = "https://api.apify.com/v2";
const ACTOR = "curious_coder~linkedin-jobs-scraper";
const SOURCE = "LinkedIn";
const PAST_24_HOURS = "r86400";

type LinkedInJob = {
  title: string;
  companyName: string;
  location?: string;
  link: string;
  postedAt: string;
  descriptionText?: string;
};

async function apify<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`Apify request failed (${response.status}): ${await response.text()}`);
  return response.json() as Promise<T>;
}

function postedToday(searchUrl: string) {
  const url = new URL(searchUrl);
  url.searchParams.set("f_TPR", PAST_24_HOURS);
  return url.href;
}

export const linkedInJobBoard: JobBoardGateway = {
  source: SOURCE,

  async start({ searchUrls }: JobBoardSettings, token: string) {
    const webhooks = Buffer.from(
      JSON.stringify([
        {
          eventTypes: ["ACTOR.RUN.SUCCEEDED"],
          requestUrl: `${env.APP_URL}/api/webhooks/apify`,
          payloadTemplate: `{"secret":${JSON.stringify(env.APIFY_WEBHOOK_SECRET)},"resource":{{resource}}}`,
        },
      ]),
    ).toString("base64");

    const { data } = await apify<{ data: { id: string } }>(
      `/acts/${ACTOR}/runs?webhooks=${encodeURIComponent(webhooks)}`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          urls: searchUrls.map(postedToday),
          limitPerSource: Math.ceil(JOBS_PER_RUN / searchUrls.length),
        }),
      },
    );
    return data.id;
  },

  async results({ runId, token }: ActorRun) {
    const items = await apify<LinkedInJob[]>(`/actor-runs/${runId}/dataset/items?clean=true`, token);

    return items.map((item) => ({
      source: SOURCE,
      title: item.title,
      companyName: item.companyName,
      location: item.location ?? "",
      url: item.link.split("?")[0]!,
      postDay: item.postedAt,
      description: item.descriptionText ?? null,
    }));
  },
};
