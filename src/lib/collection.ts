import { drizzleActorRunStore, drizzleJobBoardSettingsStore, drizzleJobStore } from "./drizzle";
import { env } from "./env";
import { linkedInJobBoard } from "./linkedin-job-board";

export function collectionServices() {
  return {
    jobBoards: [linkedInJobBoard],
    jobBoardSettings: drizzleJobBoardSettingsStore(),
    actorRuns: drizzleActorRunStore(),
    jobs: drizzleJobStore(),
    apifyTokens: env.APIFY_TOKENS,
  };
}
