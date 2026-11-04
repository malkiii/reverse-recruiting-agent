import { setTimeout } from "node:timers/promises";
import {
  drizzleActorRunStore,
  drizzleExcludedKeywordStore,
  drizzleFunctionRunStore,
  drizzleGoogleConnectionStore,
  drizzleJobBoardSettingsStore,
  drizzleJobFeedStore,
  drizzleJobStore,
  drizzleSkippedApifyTokenStore,
} from "../lib/drizzle";
import { parseFunctionsEnv } from "../lib/env";
import { firecrawlJobFeedReader } from "../lib/firecrawl-job-feed";
import { googleOAuth } from "../lib/google";
import { googleAccessToken } from "../lib/google-connection";
import { glassdoorJobBoard } from "../lib/glassdoor-job-board";
import { webImageGateway } from "../lib/images";
import { FUNCTION_TIME_LIMITS_MS } from "../lib/function-runs";
import { runCollection } from "../lib/job-collection";
import { linkedInJobBoard } from "../lib/linkedin-job-board";
import { COLLECT_JOBS } from "../lib/schema";
import { telegramGateway } from "../lib/telegram";

type Services = ReturnType<typeof functionServices>;

type FunctionDefinition = { timeLimitMs: number; work: (services: Services) => Promise<void> };

export const functions = new Map<string, FunctionDefinition>([
  ["noop", { timeLimitMs: FUNCTION_TIME_LIMITS_MS.noop, work: async () => {} }],
  [COLLECT_JOBS, { timeLimitMs: FUNCTION_TIME_LIMITS_MS[COLLECT_JOBS], work: runCollection }],
]);

export function functionServices() {
  const {
    DATABASE_URL,
    FUNCTIONS_SECRET,
    APIFY_TOKENS,
    FIRECRAWL_API_KEY,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
    DASHBOARD_URL,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
  } = parseFunctionsEnv(process.env);
  const now = () => new Date();
  const googleConnection = {
    store: drizzleGoogleConnectionStore(DATABASE_URL),
    oauth: googleOAuth(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET),
    now,
  };
  return {
    runs: drizzleFunctionRunStore(DATABASE_URL),
    secret: FUNCTIONS_SECRET,
    now,
    sleep: async (ms: number) => void (await setTimeout(ms)),
    jobBoards: [linkedInJobBoard, glassdoorJobBoard],
    jobBoardSettings: drizzleJobBoardSettingsStore(DATABASE_URL),
    excludedKeywords: drizzleExcludedKeywordStore(DATABASE_URL),
    actorRuns: drizzleActorRunStore(DATABASE_URL),
    jobs: drizzleJobStore(DATABASE_URL),
    jobFeeds: drizzleJobFeedStore(DATABASE_URL),
    feedReader: firecrawlJobFeedReader(FIRECRAWL_API_KEY),
    apifyTokens: APIFY_TOKENS,
    skippedApifyTokens: drizzleSkippedApifyTokenStore(DATABASE_URL),
    telegram: telegramGateway(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID),
    images: webImageGateway(),
    dashboardUrl: DASHBOARD_URL,
    /** The Admin's Google access token, from the connection the dashboard stored. */
    googleAccessToken: () => googleAccessToken(googleConnection),
  };
}
