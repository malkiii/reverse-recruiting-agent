import { bigint, boolean, date, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";

export const jobs = pgTable(
  "jobs",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    source: text().notNull(),
    title: text().notNull(),
    companyName: text("company_name").notNull(),
    location: text().notNull(),
    url: text().notNull().unique("jobs_url_key"),
    postDay: date("post_day", { mode: "string" }).notNull(),
    description: text(),
  },
  (table) => [unique("jobs_title_company_name_post_day_key").on(table.title, table.companyName, table.postDay)],
).enableRLS();

export const jobBoardSettings = pgTable("job_board_settings", {
  source: text().primaryKey(),
  enabled: boolean().notNull().default(false),
  searchUrls: text("search_urls").array().notNull().default([]),
}).enableRLS();

export const actorRuns = pgTable("actor_runs", {
  runId: text("run_id").primaryKey(),
  source: text().notNull(),
  token: text().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
}).enableRLS();

export const jobSchema = createSelectSchema(jobs).omit({ id: true });
export const jobBoardSettingsSchema = createSelectSchema(jobBoardSettings);
export const actorRunSchema = createSelectSchema(actorRuns);
