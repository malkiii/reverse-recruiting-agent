import { desc, eq } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { FunctionRunResult, FunctionRunStore } from "./gateways";
import { functionRuns } from "./schema";

const RUNS_SHOWN = 20;

let db: PostgresJsDatabase | undefined;

function client(databaseUrl: string) {
  db ??= drizzle(postgres(databaseUrl, { prepare: false, max: 1 }));
  return db;
}

export function drizzleFunctionRunStore(databaseUrl: string): FunctionRunStore {
  return {
    async start(functionName: string, startedAt: Date) {
      const [run] = await client(databaseUrl)
        .insert(functionRuns)
        .values({ functionName, status: "running", startedAt })
        .returning({ id: functionRuns.id });
      return run.id;
    },

    async finish(id: number, result: FunctionRunResult) {
      await client(databaseUrl).update(functionRuns).set(result).where(eq(functionRuns.id, id));
    },

    list() {
      return client(databaseUrl).select().from(functionRuns).orderBy(desc(functionRuns.id)).limit(RUNS_SHOWN);
    },
  };
}
