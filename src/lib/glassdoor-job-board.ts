import { NodeHtmlMarkdown } from "node-html-markdown";
import { z } from "zod";
import { actorRunItems, actorRunStatus, startActorRun } from "./apify-actor";
import type { ActorRun, JobBoardGateway, JobBoardRunOptions } from "./gateways";
import type { JobSearch } from "./schema";

const ACTOR = "valig/glassdoor-jobs-scraper";
const SOURCE = "Glassdoor";
// A real run confirmed that 1 means the last day, with ageInDays 0 for Jobs posted today.
const DAYS_OLD = 1;

const itemSchema = z.object({
  url: z.string(),
  title: z.string(),
  employer: z.object({ name: z.string(), logoUrl: z.string().nullish() }),
  location: z.object({ name: z.string().nullish() }).nullish(),
  ageInDays: z.number(),
  description: z.string().nullish(),
});

export const glassdoorJobBoard: JobBoardGateway = {
  source: SOURCE,
  actor: ACTOR,

  start({ keywords, location }: JobSearch, limit: number, token: string, { remoteOnly }: JobBoardRunOptions) {
    return startActorRun(ACTOR, { keywords, location, daysOld: DAYS_OLD, limit, remoteWorkType: remoteOnly }, token);
  },

  status: actorRunStatus,

  results(run: ActorRun) {
    return actorRunItems(run, itemSchema, ({ url, title, employer, location, ageInDays, description }) => ({
      source: SOURCE,
      title,
      companyName: employer.name,
      location: location?.name ?? "",
      // The query is the Job's ID (?jl=), so it stays.
      url,
      ageInDays,
      // Glassdoor gives the description as HTML.
      description: description ? NodeHtmlMarkdown.translate(description) : null,
      companyLinkedinUrl: null,
      companyLogoUrl: employer.logoUrl || null,
    }));
  },
};
