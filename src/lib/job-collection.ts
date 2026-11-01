import { nextToken, parseTokens } from "./apify-tokens";
import type {
  ActorRun,
  ActorRunStore,
  FunctionRun,
  JobBoardGateway,
  JobBoardSettingsStore,
  JobStore,
} from "./gateways";
import { COLLECT_JOBS, type JobSearch } from "./schema";

export const COLLECTION_TIME_LIMIT_MS = 30 * 60_000;

const JOBS_PER_COLLECTION = 50;
const POLL_DELAY_MS = 15_000;
// Stops well inside the time limit. Whatever is still going is picked up by the next Job Collection.
const MAX_POLLS = 80;

type CollectionDeps = {
  jobBoards: JobBoardGateway[];
  jobBoardSettings: JobBoardSettingsStore;
  actorRuns: ActorRunStore;
  jobs: JobStore;
  apifyTokens: string;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
};

const utcDay = (date: Date) => date.toISOString().slice(0, 10);

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
    if (!settings?.enabled) continue;

    for (const [index, search] of settings.searches.entries()) {
      const limit = shareLimit(index, settings.searches.length);
      if (limit === 0 || alreadyRunToday(search, unfinished, jobBoard.actor, deps.now())) continue;

      try {
        const token = nextToken(tokens, await deps.actorRuns.lastToken());
        const runId = await jobBoard.start(search, limit, token);
        const run = { runId, actor: jobBoard.actor, token, search, startedAt: deps.now() };
        // Saved before polling, so a Function killed from here on loses nothing.
        await deps.actorRuns.save(run);
        started.push(run);
      } catch (error) {
        errors.push(`${jobBoard.source} search "${search.keywords}": ${message(error)}`);
      }
    }
  }
  return started;
}

export async function runCollection(deps: CollectionDeps) {
  const errors: string[] = [];
  const unfinished = await deps.actorRuns.listUnfinished();
  const runs = [...unfinished, ...(await startActorRuns(deps, unfinished, errors))];

  // Counted per Job Board and day: a run left from an earlier day has its own 50.
  const savedPerBoardDay = new Map<string, number>();
  let pollsLeft = MAX_POLLS;

  for (const run of runs) {
    const jobBoard = deps.jobBoards.find(({ actor }) => actor === run.actor);
    if (!jobBoard) continue;

    try {
      let status = await jobBoard.status(run);
      while (status === "running" && pollsLeft > 0) {
        pollsLeft -= 1;
        await deps.sleep(POLL_DELAY_MS);
        status = await jobBoard.status(run);
      }
      if (status === "running") continue;

      if (status === "failed") {
        errors.push(`Actor run ${run.runId} failed`);
      } else {
        // "Today" is the day the run started, so a run saved after midnight keeps its Jobs.
        const collected = await jobBoard.results(run);
        const postedToday = collected.filter(({ postDay }) => postDay === utcDay(run.startedAt));
        const boardDay = `${run.actor} ${utcDay(run.startedAt)}`;
        const saved = savedPerBoardDay.get(boardDay) ?? 0;
        const jobs = postedToday.slice(0, JOBS_PER_COLLECTION - saved);
        savedPerBoardDay.set(boardDay, saved + (await deps.jobs.save(jobs)));
      }
      await deps.actorRuns.close(run.runId, deps.now());
    } catch (error) {
      errors.push(`Actor run ${run.runId}: ${message(error)}`);
    }
  }

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
