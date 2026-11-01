import type { actorRuns, functionRuns, jobBoardSettings, jobs, JobSearch } from "./schema";

export type FunctionRun = typeof functionRuns.$inferSelect;

export type FunctionRunResult = Pick<FunctionRun, "finishedAt" | "error"> & {
  status: "succeeded" | "failed";
};

export interface FunctionRunStore {
  /** Marks runs past the time limit as failed, then claims a new run. Null means one is already active. */
  start(functionName: string, startedAt: Date, timeLimitMs: number): Promise<number | null>;
  finish(id: number, result: FunctionRunResult): Promise<void>;
  list(): Promise<FunctionRun[]>;
}

export type Job = Omit<typeof jobs.$inferSelect, "id">;
export type JobBoardSettings = typeof jobBoardSettings.$inferSelect;
export type ActorRun = Omit<typeof actorRuns.$inferSelect, "resultsSavedAt">;
export type ActorRunStatus = "running" | "succeeded" | "failed";

export interface JobStore {
  /** Ignores any Job whose URL is already saved, and returns how many were new. */
  save(jobs: Job[]): Promise<number>;
  list(): Promise<Job[]>;
}

export interface JobBoardSettingsStore {
  get(source: string): Promise<JobBoardSettings | undefined>;
  save(settings: JobBoardSettings): Promise<void>;
}

export interface ActorRunStore {
  save(run: ActorRun): Promise<void>;
  /** Every actor run that hasn't been closed yet, oldest first. */
  listUnfinished(): Promise<ActorRun[]>;
  /** Closes the run, whether its results were saved or it failed and had none. */
  close(runId: string, closedAt: Date): Promise<void>;
  lastToken(): Promise<string | undefined>;
}

export interface JobBoardGateway {
  source: string;
  actor: string;
  start(search: JobSearch, limit: number, token: string): Promise<string>;
  status(run: ActorRun): Promise<ActorRunStatus>;
  results(run: ActorRun): Promise<Job[]>;
}
