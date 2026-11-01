import { setTimeout } from "node:timers/promises";
import {
  drizzleActorRunStore,
  drizzleFunctionRunStore,
  drizzleJobBoardSettingsStore,
  drizzleJobStore,
} from "../lib/drizzle";
import { parseFunctionsEnv } from "../lib/env";
import { COLLECTION_TIME_LIMIT_MS, runCollection } from "../lib/job-collection";
import { linkedInJobBoard } from "../lib/linkedin-job-board";
import { COLLECT_JOBS } from "../lib/schema";

type Services = ReturnType<typeof functionServices>;

type FunctionDefinition = { timeLimitMs: number; work: (services: Services) => Promise<void> };

export const functions = new Map<string, FunctionDefinition>([
  ["noop", { timeLimitMs: 60_000, work: async () => {} }],
  [COLLECT_JOBS, { timeLimitMs: COLLECTION_TIME_LIMIT_MS, work: runCollection }],
]);

export function functionServices() {
  const { DATABASE_URL, FUNCTIONS_SECRET, APIFY_TOKENS } = parseFunctionsEnv(process.env);
  return {
    runs: drizzleFunctionRunStore(DATABASE_URL),
    secret: FUNCTIONS_SECRET,
    now: () => new Date(),
    sleep: async (ms: number) => void (await setTimeout(ms)),
    jobBoards: [linkedInJobBoard],
    jobBoardSettings: drizzleJobBoardSettingsStore(DATABASE_URL),
    actorRuns: drizzleActorRunStore(DATABASE_URL),
    jobs: drizzleJobStore(DATABASE_URL),
    apifyTokens: APIFY_TOKENS,
  };
}
