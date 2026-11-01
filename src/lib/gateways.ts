import type { functionRuns } from "./schema";

export type FunctionRun = typeof functionRuns.$inferSelect;

export type FunctionRunResult = Pick<FunctionRun, "finishedAt" | "error"> & {
  status: "succeeded" | "failed";
};

export interface FunctionRunStore {
  start(functionName: string, startedAt: Date): Promise<number>;
  finish(id: number, result: FunctionRunResult): Promise<void>;
  list(): Promise<FunctionRun[]>;
}
