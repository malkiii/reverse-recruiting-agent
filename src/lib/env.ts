import { z } from "zod";

type Variables = Record<string, string | undefined>;

const functionsSchema = z.object({
  DATABASE_URL: z.url(),
  FUNCTIONS_SECRET: z.string().min(1),
});

const dashboardSchema = functionsSchema.extend({
  DASHBOARD_PASSWORD: z.string().min(1),
  FUNCTIONS_BASE_URL: z.url(),
});

export const parseFunctionsEnv = (variables: Variables) => functionsSchema.parse(variables);

export const parseDashboardEnv = (variables: Variables) => dashboardSchema.parse(variables);
