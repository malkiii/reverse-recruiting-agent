import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const functionRuns = pgTable("function_runs", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  functionName: text("function_name").notNull(),
  status: text({ enum: ["running", "succeeded", "failed"] }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  error: text(),
}).enableRLS();
