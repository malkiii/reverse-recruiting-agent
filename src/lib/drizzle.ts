import { desc, eq, getTableColumns } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env";
import type { ActorRun, ActorRunStore, Job, JobBoardSettings, JobBoardSettingsStore, JobStore } from "./gateways";
import { actorRuns, jobBoardSettings, jobs as jobsTable } from "./schema";

const { id, ...jobColumns } = getTableColumns(jobsTable);

let db: PostgresJsDatabase | undefined;

function client() {
  db ??= drizzle(postgres(env.DATABASE_URL, { prepare: false, max: 1 }));
  return db;
}

export function drizzleJobStore(): JobStore {
  return {
    async save(jobs: Job[]) {
      if (jobs.length > 0) await client().insert(jobsTable).values(jobs).onConflictDoNothing();
    },

    list() {
      return client().select(jobColumns).from(jobsTable).orderBy(desc(jobsTable.postDay));
    },
  };
}

export function drizzleJobBoardSettingsStore(): JobBoardSettingsStore {
  return {
    async get(source: string) {
      const [settings] = await client().select().from(jobBoardSettings).where(eq(jobBoardSettings.source, source));
      return settings;
    },

    async save(settings: JobBoardSettings) {
      await client()
        .insert(jobBoardSettings)
        .values(settings)
        .onConflictDoUpdate({ target: jobBoardSettings.source, set: settings });
    },
  };
}

export function drizzleActorRunStore(): ActorRunStore {
  return {
    async save(run: ActorRun) {
      await client().insert(actorRuns).values(run);
    },

    async get(runId: string) {
      const [run] = await client().select().from(actorRuns).where(eq(actorRuns.runId, runId));
      return run;
    },

    async lastToken() {
      const [run] = await client().select().from(actorRuns).orderBy(desc(actorRuns.startedAt)).limit(1);
      return run?.token;
    },
  };
}
