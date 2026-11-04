import { sql } from "drizzle-orm";
import { bigint, boolean, check, date, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const COLLECT_JOBS = "collect-jobs";
export const PREPARE_APPLICATION = "prepare-application";

export const LLM_PROVIDERS = ["claude", "gemini", "openai", "groq"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export const APPLICATION_STATUSES = [
  "preparing",
  "in-review",
  "sending",
  "sent",
  "cancelled",
  "direct-apply",
  "no-contacts",
  "all-in-cooldown",
  "failed",
] as const;

/** The Prepare steps, in order. A step is current until it finishes. */
export const PREPARE_STEPS = ["read-job", "choose-resume", "find-company-page"] as const;

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
    /** The Application a prepare-application or send-application run served. */
    applicationId: bigint("application_id", { mode: "number" }),
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
    companyLogoUrl: text("company_logo_url"),
    // Jobs that existed at go-live, or that older code saves, are dashboard-only. Job Collection saves new Jobs as pending.
    alertState: text("alert_state", { enum: ["pending", "sent", "dashboard-only"] })
      .notNull()
      .default("dashboard-only"),
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

/** A word or phrase that, found in a Job's title, keeps the Job from being saved. */
export const excludedKeywords = pgTable("excluded_keywords", {
  keyword: text().primaryKey(),
}).enableRLS();

/** A rate-limited or out-of-credit Apify token, and when it can be used again. */
export const skippedApifyTokens = pgTable("skipped_apify_tokens", {
  token: text().primaryKey(),
  usableAt: timestamp("usable_at", { withTimezone: true }).notNull(),
}).enableRLS();

export const actorRuns = pgTable("actor_runs", {
  runId: text("run_id").primaryKey(),
  actor: text().notNull(),
  token: text().notNull(),
  search: jsonb().$type<JobSearch>(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  resultsSavedAt: timestamp("results_saved_at", { withTimezone: true }),
}).enableRLS();

// The table holds a single row, so the dashboard and Functions always read the same one.
const singleRow = () => [check("single_row", sql`id = 1`)];

/** The Admin's Google account, connected through OAuth, read by the dashboard and Functions. */
export const googleConnection = pgTable(
  "google_connection",
  {
    id: integer().primaryKey().default(1),
    refreshToken: text("refresh_token").notNull(),
    accessToken: text("access_token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  singleRow,
).enableRLS();

export const settings = pgTable(
  "settings",
  {
    id: integer().primaryKey().default(1),
    resumeFolderId: text("resume_folder_id"),
    resumeFolderName: text("resume_folder_name"),
    llmProvider: text("llm_provider", { enum: LLM_PROVIDERS }),
    llmModel: text("llm_model"),
  },
  singleRow,
).enableRLS();

/** At most one per Job, so a double click on Prepare claims only one, and a cancelled Job can't be Prepared again. */
export const applications = pgTable("applications", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  jobId: bigint("job_id", { mode: "number" })
    .notNull()
    .unique()
    .references(() => jobs.id),
  status: text({ enum: APPLICATION_STATUSES }).notNull(),
  currentStep: text("current_step", { enum: PREPARE_STEPS }).notNull(),
  /** Why the Application stopped, when it did. */
  error: text(),
  /** The Job page as markdown, kept so a Retry doesn't pay to read it again. */
  jobPage: text("job_page"),
  industryKeywords: jsonb("industry_keywords").$type<string[]>(),
  jobLocation: text("job_location"),
  jobSummary: text("job_summary"),
  resumeFileId: text("resume_file_id"),
  resumeName: text("resume_name"),
  resumeLink: text("resume_link"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}).enableRLS();
