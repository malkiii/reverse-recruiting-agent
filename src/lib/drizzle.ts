import { and, asc, desc, eq, getTableColumns, gt, isNull, lte } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type {
  ActorRun,
  ActorRunStore,
  ExcludedKeywordStore,
  FunctionRunResult,
  FunctionRunStore,
  Job,
  JobBoardSettings,
  JobBoardSettingsStore,
  JobFeed,
  JobFeedStore,
  JobStore,
  SkippedApifyTokenStore,
} from "./gateways";
import { actorRuns, excludedKeywords, functionRuns, jobBoardSettings, jobFeeds, jobs, skippedApifyTokens } from "./schema";

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
        .values(newJobs.map((job) => ({ ...job, alertState: "pending" as const })))
        // No target, so both Duplicate Job rules are ignored: the URL and the title, Company and post day.
        .onConflictDoNothing()
        .returning({ id: jobs.id });
      return inserted.length;
    },

    list() {
      const { id: _id, alertState: _alertState, ...columns } = getTableColumns(jobs);
      return client(databaseUrl)
        .select(columns)
        .from(jobs)
        .orderBy(desc(jobs.id))
        .limit(JOBS_SHOWN);
    },

    listPendingAlerts() {
      const { alertState: _alertState, ...columns } = getTableColumns(jobs);
      return client(databaseUrl)
        .select(columns)
        .from(jobs)
        .where(eq(jobs.alertState, "pending"))
        .orderBy(asc(jobs.id));
    },

    async markAlertSent(id: number) {
      await client(databaseUrl).update(jobs).set({ alertState: "sent" }).where(eq(jobs.id, id));
    },
  };
}

export function drizzleJobFeedStore(databaseUrl: string): JobFeedStore {
  return {
    list() {
      return client(databaseUrl).select().from(jobFeeds).orderBy(asc(jobFeeds.id));
    },

    async add(url: string) {
      const [feed] = await client(databaseUrl).insert(jobFeeds).values({ url }).returning();
      return feed;
    },

    async update({ id, url, enabled }: JobFeed) {
      await client(databaseUrl).update(jobFeeds).set({ url, enabled }).where(eq(jobFeeds.id, id));
    },

    async remove(id: number) {
      await client(databaseUrl).delete(jobFeeds).where(eq(jobFeeds.id, id));
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

export function drizzleExcludedKeywordStore(databaseUrl: string): ExcludedKeywordStore {
  return {
    async list() {
      const rows = await client(databaseUrl).select().from(excludedKeywords).orderBy(asc(excludedKeywords.keyword));
      return rows.map(({ keyword }) => keyword);
    },

    async replace(keywords: string[]) {
      await client(databaseUrl).transaction(async (tx) => {
        await tx.delete(excludedKeywords);
        if (keywords.length > 0) {
          await tx
            .insert(excludedKeywords)
            .values(keywords.map((keyword) => ({ keyword })))
            .onConflictDoNothing();
        }
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

export function drizzleSkippedApifyTokenStore(databaseUrl: string): SkippedApifyTokenStore {
  return {
    async listSkipped(at: Date) {
      const rows = await client(databaseUrl)
        .select({ token: skippedApifyTokens.token })
        .from(skippedApifyTokens)
        .where(gt(skippedApifyTokens.usableAt, at));
      return rows.map(({ token }) => token);
    },

    async skip(token: string, usableAt: Date) {
      await client(databaseUrl)
        .insert(skippedApifyTokens)
        .values({ token, usableAt })
        .onConflictDoUpdate({ target: skippedApifyTokens.token, set: { usableAt } });
    },
  };
}
