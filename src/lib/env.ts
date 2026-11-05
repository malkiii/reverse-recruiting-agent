import { z } from "zod";

type Variables = Record<string, string | undefined>;

// An empty line copied from .env.example counts as unset.
const optionalKey = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const sharedSchema = z.object({
  DATABASE_URL: z.url(),
  FUNCTIONS_SECRET: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
});

const functionsSchema = sharedSchema.extend({
  APIFY_TOKENS: z.string().min(1),
  FIRECRAWL_API_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHAT_ID: z.string().min(1),
  DASHBOARD_URL: z.url(),
  // Only the LLM provider chosen in settings needs its key.
  ANTHROPIC_API_KEY: optionalKey,
  GEMINI_API_KEY: optionalKey,
  OPENAI_API_KEY: optionalKey,
  GROQ_API_KEY: optionalKey,
  // Off unless set to "true", so Compose and any environment that forgets it can't email Decision Makers.
  ALLOW_SEND: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});

const dashboardSchema = sharedSchema.extend({
  DASHBOARD_PASSWORD: z.string().min(1),
  FUNCTIONS_BASE_URL: z.url(),
});

export const parseFunctionsEnv = (variables: Variables) => functionsSchema.parse(variables);

export const parseDashboardEnv = (variables: Variables) => dashboardSchema.parse(variables);
