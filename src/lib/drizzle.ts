import { desc, getTableColumns } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env";
import type { Job, JobStore } from "./gateways";
import { jobs as jobsTable } from "./schema";

const { id, ...jobColumns } = getTableColumns(jobsTable);

let db: PostgresJsDatabase | undefined;

export function drizzleJobStore(): JobStore {
  db ??= drizzle(postgres(env.DATABASE_URL, { prepare: false, max: 1 }));
  const client = db;

  return {
    async save(jobs: Job[]) {
      if (jobs.length > 0) await client.insert(jobsTable).values(jobs);
    },

    list() {
      return client.select(jobColumns).from(jobsTable).orderBy(desc(jobsTable.postDay));
    },
  };
}
