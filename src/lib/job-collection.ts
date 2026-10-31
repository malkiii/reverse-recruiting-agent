import { nextToken } from "./apify-tokens";
import { JOBS_PER_RUN } from "./gateways";
import type { ActorRunStore, JobBoardGateway, JobBoardSettingsStore, JobStore } from "./gateways";
import { jobSchema } from "./schema";

export async function runCollection({
  jobBoards,
  jobBoardSettings,
  actorRuns,
  apifyTokens,
  now = new Date(),
}: {
  jobBoards: JobBoardGateway[];
  jobBoardSettings: JobBoardSettingsStore;
  actorRuns: ActorRunStore;
  apifyTokens: string;
  now?: Date;
}) {
  for (const jobBoard of jobBoards) {
    const settings = await jobBoardSettings.get(jobBoard.source);
    if (!settings?.enabled || settings.searchUrls.length === 0) continue;

    const token = nextToken(apifyTokens, await actorRuns.lastToken());
    const runId = await jobBoard.start(settings, token);
    await actorRuns.save({ runId, source: jobBoard.source, token, startedAt: now });
  }
}

export async function resumeCollection({
  jobBoards,
  actorRuns,
  jobs,
  runId,
}: {
  jobBoards: JobBoardGateway[];
  actorRuns: ActorRunStore;
  jobs: JobStore;
  runId: string;
}) {
  const run = await actorRuns.get(runId);
  const jobBoard = jobBoards.find(({ source }) => source === run?.source);
  if (!run || !jobBoard) return;

  const today = run.startedAt.toISOString().slice(0, 10);
  const collected = jobSchema.array().parse(await jobBoard.results(run));
  await jobs.save(collected.filter((job) => job.postDay === today).slice(0, JOBS_PER_RUN));
}
