import { z } from "zod";

type Variables = Record<string, string | undefined>;

const sharedSchema = z.object({
  DATABASE_URL: z.url(),
  FUNCTIONS_SECRET: z.string().min(1),
});

const functionsSchema = sharedSchema.extend({
  APIFY_TOKENS: z.string().min(1),
});

const dashboardSchema = sharedSchema.extend({
  DASHBOARD_PASSWORD: z.string().min(1),
  FUNCTIONS_BASE_URL: z.url(),
});

export const parseFunctionsEnv = (variables: Variables) => functionsSchema.parse(variables);

export const parseDashboardEnv = (variables: Variables) => dashboardSchema.parse(variables);
