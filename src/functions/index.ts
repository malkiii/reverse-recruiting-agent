import { setTimeout } from "node:timers/promises";
import { z } from "zod";
import { prepare, runPreparation } from "../lib/application-lifecycle";
import {
  drizzleActorRunStore,
  drizzleApplicationStore,
  drizzleCompanyStore,
  drizzleLlmSettingsStore,
  drizzleResumeFolderStore,
  drizzleExcludedKeywordStore,
  drizzleFunctionRunStore,
  drizzleGoogleConnectionStore,
  drizzleJobBoardSettingsStore,
  drizzleJobFeedStore,
  drizzleJobStore,
  drizzleSkippedApifyTokenStore,
} from "../lib/drizzle";
import { parseFunctionsEnv } from "../lib/env";
import { firecrawlCompanyPageSearch } from "../lib/firecrawl-company-page";
import { firecrawlJobFeedReader } from "../lib/firecrawl-job-feed";
import { firecrawlJobPageReader } from "../lib/firecrawl-job-page";
import { googleDrive, googleOAuth } from "../lib/google";
import { googleAccessToken } from "../lib/google-connection";
import { glassdoorJobBoard } from "../lib/glassdoor-job-board";
import { webImageGateway } from "../lib/images";
import { FUNCTION_TIME_LIMITS_MS } from "../lib/function-runs";
import { runCollection } from "../lib/job-collection";
import { linkedInJobBoard } from "../lib/linkedin-job-board";
import { llmGateway } from "../lib/llm";
import { COLLECT_JOBS, PREPARE_APPLICATION } from "../lib/schema";
import { telegramGateway } from "../lib/telegram";
import { InvalidFunctionRequestError } from "./accept-function-request";

type Services = ReturnType<typeof functionServices>;

type FunctionDefinition = {
  timeLimitMs: number;
  /** Claims the Application named in the request body. Null when it isn't in a startable state. */
  claim?: (services: Services, body: unknown) => Promise<number | null>;
  work: (services: Services, applicationId?: number) => Promise<void>;
};

const prepareRequestSchema = z.object({ jobId: z.number().int().positive() });

function requireApplication(applicationId: number | undefined) {
  if (applicationId === undefined) throw new Error("No Application was given");
  return applicationId;
}

export const functions = new Map<string, FunctionDefinition>([
  ["noop", { timeLimitMs: FUNCTION_TIME_LIMITS_MS.noop, work: async () => {} }],
  [COLLECT_JOBS, { timeLimitMs: FUNCTION_TIME_LIMITS_MS[COLLECT_JOBS], work: runCollection }],
  [
    PREPARE_APPLICATION,
    {
      timeLimitMs: FUNCTION_TIME_LIMITS_MS[PREPARE_APPLICATION],
      async claim(services, body) {
        const request = prepareRequestSchema.safeParse(body);
        if (!request.success) throw new InvalidFunctionRequestError("The request body needs a numeric jobId");
        return prepare(services, request.data.jobId);
      },
      work: (services, applicationId) => runPreparation(services, requireApplication(applicationId)),
    },
  ],
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
    ANTHROPIC_API_KEY,
    GEMINI_API_KEY,
    OPENAI_API_KEY,
    GROQ_API_KEY,
  } = parseFunctionsEnv(process.env);
  const now = () => new Date();
  const googleConnection = {
    store: drizzleGoogleConnectionStore(DATABASE_URL),
    oauth: googleOAuth(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET),
    now,
  };
  const accessToken = () => googleAccessToken(googleConnection);
  const llmSettings = drizzleLlmSettingsStore(DATABASE_URL);
  const llmApiKeys = { claude: ANTHROPIC_API_KEY, gemini: GEMINI_API_KEY, openai: OPENAI_API_KEY, groq: GROQ_API_KEY };
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
    googleAccessToken: accessToken,
    applications: drizzleApplicationStore(DATABASE_URL),
    jobPages: firecrawlJobPageReader(FIRECRAWL_API_KEY),
    companies: drizzleCompanyStore(DATABASE_URL),
    companyPageSearch: firecrawlCompanyPageSearch(FIRECRAWL_API_KEY),
    resumeFolder: drizzleResumeFolderStore(DATABASE_URL),
    drive: async () => googleDrive(await accessToken()),
    llm: async () => llmGateway(await llmSettings.get(), llmApiKeys),
  };
}
