import { and, asc, desc, eq, getTableColumns, isNull, lte } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type {
  ActorRun,
  ActorRunStore,
  FunctionRunResult,
  FunctionRunStore,
  Job,
  JobBoardSettings,
  JobBoardSettingsStore,
  JobStore,
} from "./gateways";
import { actorRuns, functionRuns, jobBoardSettings, jobs } from "./schema";

const RUNS_SHOWN = 20;
const JOBS_SHOWN = 200;

let db: PostgresJsDatabase | undefined;

function client(databaseUrl: string) {
  // Pipelined queries hang forever through the Supabase transaction pooler.
  db ??= drizzle(postgres(databaseUrl, { prepare: false, max: 1, max_pipeline: 1 }));
  return db;
}

export function drizzleFunctionRunStore(databaseUrl: string): FunctionRunStore {
  return {
    async start(functionName: string, startedAt: Date, timeLimitMs: number) {
      await client(databaseUrl)
        .update(functionRuns)
        .set({ status: "failed", finishedAt: startedAt, error: "Passed its time limit" })
        .where(
          and(
            eq(functionRuns.functionName, functionName),
            eq(functionRuns.status, "running"),
            lte(functionRuns.startedAt, new Date(startedAt.getTime() - timeLimitMs)),
          ),
        );

      // The one_active_job_collection index makes this the atomic claim for a Job Collection.
      const [run] = await client(databaseUrl)
        .insert(functionRuns)
        .values({ functionName, status: "running", startedAt })
        .onConflictDoNothing()
        .returning({ id: functionRuns.id });
      return run?.id ?? null;
    },

    async finish(id: number, result: FunctionRunResult) {
      await client(databaseUrl).update(functionRuns).set(result).where(eq(functionRuns.id, id));
    },

    list() {
      return client(databaseUrl).select().from(functionRuns).orderBy(desc(functionRuns.id)).limit(RUNS_SHOWN);
    },
  };
}

export function drizzleJobStore(databaseUrl: string): JobStore {
  return {
    async save(newJobs: Job[]) {
      if (newJobs.length === 0) return 0;
      const inserted = await client(databaseUrl)
        .insert(jobs)
        .values(newJobs)
        .onConflictDoNothing({ target: jobs.url })
        .returning({ id: jobs.id });
      return inserted.length;
    },

    list() {
      const { id: _id, ...columns } = getTableColumns(jobs);
      return client(databaseUrl)
        .select(columns)
        .from(jobs)
        .orderBy(desc(jobs.id))
        .limit(JOBS_SHOWN);
    },
  };
}

export function drizzleJobBoardSettingsStore(databaseUrl: string): JobBoardSettingsStore {
  return {
    async get(source: string) {
      const [settings] = await client(databaseUrl)
        .select()
        .from(jobBoardSettings)
        .where(eq(jobBoardSettings.source, source));
      return settings;
    },

    async save(settings: JobBoardSettings) {
      await client(databaseUrl)
        .insert(jobBoardSettings)
        .values(settings)
        .onConflictDoUpdate({
          target: jobBoardSettings.source,
          set: { enabled: settings.enabled, searches: settings.searches },
        });
    },
  };
}

export function drizzleActorRunStore(databaseUrl: string): ActorRunStore {
  return {
    async save(run: ActorRun) {
      await client(databaseUrl).insert(actorRuns).values(run);
    },

    listUnfinished() {
      return client(databaseUrl)
        .select({
          runId: actorRuns.runId,
          actor: actorRuns.actor,
          token: actorRuns.token,
          search: actorRuns.search,
          startedAt: actorRuns.startedAt,
        })
        .from(actorRuns)
        .where(isNull(actorRuns.resultsSavedAt))
        .orderBy(asc(actorRuns.startedAt));
    },

    async close(runId: string, closedAt: Date) {
      await client(databaseUrl)
        .update(actorRuns)
        .set({ resultsSavedAt: closedAt })
        .where(eq(actorRuns.runId, runId));
    },

    async lastToken() {
      const [run] = await client(databaseUrl)
        .select({ token: actorRuns.token })
        .from(actorRuns)
        .orderBy(desc(actorRuns.startedAt))
        .limit(1);
      return run?.token;
    },
  };
}
