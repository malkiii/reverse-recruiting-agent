import { sql } from "drizzle-orm";
import { bigint, boolean, date, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const COLLECT_JOBS = "collect-jobs";

export type JobSearch = { keywords: string; location: string };

export const functionRuns = pgTable(
  "function_runs",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    functionName: text("function_name").notNull(),
    status: text({ enum: ["running", "succeeded", "failed"] }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: text(),
  },
  // At most one Job Collection is active across both environments.
  (table) => [
    uniqueIndex("one_active_job_collection")
      .on(table.functionName)
      .where(sql`status = 'running' and function_name = 'collect-jobs'`),
  ],
).enableRLS();

export const jobs = pgTable(
  "jobs",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    source: text().notNull(),
    title: text().notNull(),
    companyName: text("company_name").notNull(),
    location: text().notNull(),
    url: text().notNull().unique(),
    postDay: date("post_day", { mode: "string" }).notNull(),
    description: text(),
    companyLinkedinUrl: text("company_linkedin_url"),
  },
  // The second Duplicate Job rule, so the same Job on two sources is saved once.
  (table) => [
    uniqueIndex("jobs_title_company_post_day_unique").on(
      sql`lower(${table.title})`,
      sql`lower(${table.companyName})`,
      table.postDay,
    ),
  ],
).enableRLS();

export const jobFeeds = pgTable("job_feeds", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  url: text().notNull(),
  enabled: boolean().notNull().default(true),
}).enableRLS();

export const jobBoardSettings = pgTable("job_board_settings", {
  source: text().primaryKey(),
  enabled: boolean().notNull().default(false),
  searches: jsonb().$type<JobSearch[]>().notNull().default([]),
}).enableRLS();

export const actorRuns = pgTable("actor_runs", {
  runId: text("run_id").primaryKey(),
  actor: text().notNull(),
  token: text().notNull(),
  search: jsonb().$type<JobSearch>(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  resultsSavedAt: timestamp("results_saved_at", { withTimezone: true }),
}).enableRLS();
