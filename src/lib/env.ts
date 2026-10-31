import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DASHBOARD_PASSWORD: z.string().min(1),
    CRON_SECRET: z.string().min(1),
    DATABASE_URL: z.url(),
    APP_URL: z.url(),
    APIFY_TOKENS: z.string().min(1),
    APIFY_WEBHOOK_SECRET: z.string().min(1),
  },
  experimental__runtimeEnv: {},
});
