import { bigint, date, pgTable, text, unique } from "drizzle-orm/pg-core";
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

export const jobSchema = createSelectSchema(jobs).omit({ id: true });
