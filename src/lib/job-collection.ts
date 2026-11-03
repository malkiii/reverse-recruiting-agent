import { nextToken, parseTokens } from "./apify-tokens";
import type {
  ActorRun,
  ActorRunStore,
  CollectedJob,
  FunctionRun,
  Job,
  JobBoardGateway,
  JobBoardSettingsStore,
  JobFeedReader,
  JobFeedStore,
  JobStore,
} from "./gateways";
import { COLLECT_JOBS, type JobSearch } from "./schema";

export const COLLECTION_TIME_LIMIT_MS = 30 * 60_000;

const JOBS_PER_COLLECTION = 20;
const POLL_DELAY_MS = 15_000;
// Stops well inside the time limit. Whatever is still going is picked up by the next Job Collection.
const MAX_POLLS = 80;

type CollectionDeps = {
  jobBoards: JobBoardGateway[];
  jobBoardSettings: JobBoardSettingsStore;
  actorRuns: ActorRunStore;
  jobs: JobStore;
  jobFeeds: JobFeedStore;
  feedReader: JobFeedReader;
  apifyTokens: string;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
};

const utcDay = (date: Date) => date.toISOString().slice(0, 10);

const DAY_MS = 24 * 60 * 60_000;

/** A Job with no post date counts as posted on the day it was seen. */
function withPostDay({ postDay, ageInDays, ...job }: CollectedJob, seenAt: Date): Job {
  if (postDay) return { ...job, postDay };
  if (ageInDays != null) return { ...job, postDay: utcDay(new Date(seenAt.getTime() - ageInDays * DAY_MS)) };
  return { ...job, postDay: utcDay(seenAt) };
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

function shareLimit(index: number, searches: number) {
  const remainder = JOBS_PER_COLLECTION % searches;
  return Math.floor(JOBS_PER_COLLECTION / searches) + (index < remainder ? 1 : 0);
}

/** A run from an earlier day isn't a replacement for today's search, because its Jobs are a day old. */
function alreadyRunToday(search: JobSearch, unfinished: ActorRun[], actor: string, now: Date) {
  return unfinished.some(
    (run) =>
      run.actor === actor &&
      run.search?.keywords === search.keywords &&
      run.search.location === search.location &&
      utcDay(run.startedAt) === utcDay(now),
  );
}

async function startActorRuns(deps: CollectionDeps, unfinished: ActorRun[], errors: string[]) {
  const tokens = parseTokens(deps.apifyTokens);
  const started: ActorRun[] = [];

  for (const jobBoard of deps.jobBoards) {
    const settings = await deps.jobBoardSettings.get(jobBoard.source);
    if (!settings?.enabled) {
      console.log(`${jobBoard.source}: disabled, skipped`);
      continue;
    }

    for (const [index, search] of settings.searches.entries()) {
      const limit = shareLimit(index, settings.searches.length);
      if (limit === 0 || alreadyRunToday(search, unfinished, jobBoard.actor, deps.now())) {
        console.log(`${jobBoard.source} search "${search.keywords}": skipped (limit ${limit} or already run today)`);
        continue;
      }

      try {
        const token = nextToken(tokens, await deps.actorRuns.lastToken());
        const runId = await jobBoard.start(search, limit, token);
        const run = { runId, actor: jobBoard.actor, token, search, startedAt: deps.now() };
        // Saved before polling, so a Function killed from here on loses nothing.
        await deps.actorRuns.save(run);
        started.push(run);
        console.log(`${jobBoard.source} search "${search.keywords}" in ${search.location}: started actor run ${runId} (limit ${limit})`);
      } catch (error) {
        console.error(`${jobBoard.source} search "${search.keywords}": failed to start:`, error);
        errors.push(`${jobBoard.source} search "${search.keywords}": ${message(error)}`);
      }
    }
  }
  return started;
}

/** Each Job Feed is read once, so they are read while the actor runs are still going. */
async function readJobFeeds(deps: CollectionDeps, errors: string[]) {
  const feeds = (await deps.jobFeeds.list()).filter(({ enabled }) => enabled);
  console.log(`Reading ${feeds.length} enabled Job Feed(s)`);

  for (const feed of feeds) {
    try {
      const seenAt = deps.now();
      const jobs = (await deps.feedReader.read(feed.url)).map((job) => withPostDay(job, seenAt));
      const saved = await deps.jobs.save(jobs);
      console.log(`Job Feed ${feed.url}: read ${jobs.length} Job(s), ${saved} new`);
    } catch (error) {
      console.error(`Job Feed ${feed.url}: failed:`, error);
      errors.push(`Job Feed ${feed.url}: ${message(error)}`);
    }
  }
}

export async function runCollection(deps: CollectionDeps) {
  const errors: string[] = [];
  const unfinished = await deps.actorRuns.listUnfinished();
  console.log(`Job Collection started, ${unfinished.length} unfinished actor run(s) from earlier`);
  const runs = [...unfinished, ...(await startActorRuns(deps, unfinished, errors))];
  await readJobFeeds(deps, errors);

  // Counted per Job Board and day: a run left from an earlier day has its own 20.
  const savedPerBoardDay = new Map<string, number>();
  let pollsLeft = MAX_POLLS;

  for (const run of runs) {
    const jobBoard = deps.jobBoards.find(({ actor }) => actor === run.actor);
    if (!jobBoard) {
      console.warn(`Actor run ${run.runId}: no Job Board for actor ${run.actor}, skipped`);
      continue;
    }

    try {
      let status = await jobBoard.status(run);
      console.log(`Actor run ${run.runId} (${run.actor}): ${status}`);
      while (status === "running" && pollsLeft > 0) {
        pollsLeft -= 1;
        await deps.sleep(POLL_DELAY_MS);
        status = await jobBoard.status(run);
        console.log(`Actor run ${run.runId}: ${status} (${pollsLeft} poll(s) left)`);
      }
      if (status === "running") {
        console.log(`Actor run ${run.runId}: still running, left for the next Job Collection`);
        continue;
      }

      if (status === "failed") {
        console.error(`Actor run ${run.runId} failed`);
        errors.push(`Actor run ${run.runId} failed`);
      } else {
        // "Today" is the day the run started, so a run saved after midnight keeps its Jobs.
        const collected = (await jobBoard.results(run)).map((job) => withPostDay(job, run.startedAt));
        const postedToday = collected.filter(({ postDay }) => postDay === utcDay(run.startedAt));
        const boardDay = `${run.actor} ${utcDay(run.startedAt)}`;
        const saved = savedPerBoardDay.get(boardDay) ?? 0;
        const jobs = postedToday.slice(0, JOBS_PER_COLLECTION - saved);
        const newJobs = await deps.jobs.save(jobs);
        savedPerBoardDay.set(boardDay, saved + newJobs);
        console.log(
          `Actor run ${run.runId}: ${collected.length} result(s), ${postedToday.length} posted today, ${newJobs} new saved`,
        );
      }
      await deps.actorRuns.close(run.runId, deps.now());
    } catch (error) {
      console.error(`Actor run ${run.runId}: failed:`, error);
      errors.push(`Actor run ${run.runId}: ${message(error)}`);
    }
  }

  console.log(`Job Collection finished with ${errors.length} error(s)`);
  if (errors.length > 0) throw new Error(errors.join("; "));
}

/** Matches the claim in FunctionRunStore.start: a run past its time limit no longer counts. */
export function isCollectionActive(runs: FunctionRun[], now: Date) {
  return runs.some(
    ({ functionName, status, startedAt }) =>
      functionName === COLLECT_JOBS &&
      status === "running" &&
      now.getTime() - startedAt.getTime() < COLLECTION_TIME_LIMIT_MS,
  );
}
