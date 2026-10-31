import type { z } from "zod";
import type { actorRunSchema, jobBoardSettingsSchema, jobSchema } from "./schema";

export type Job = z.infer<typeof jobSchema>;
export type JobBoardSettings = z.infer<typeof jobBoardSettingsSchema>;
export type ActorRun = z.infer<typeof actorRunSchema>;

export const JOBS_PER_RUN = 50;

export interface JobBoardGateway {
  source: string;
  start(settings: JobBoardSettings, token: string): Promise<string>;
  results(run: ActorRun): Promise<Job[]>;
}

export interface JobStore {
  save(jobs: Job[]): Promise<void>;
  list(): Promise<Job[]>;
}

export interface JobBoardSettingsStore {
  get(source: string): Promise<JobBoardSettings | undefined>;
  save(settings: JobBoardSettings): Promise<void>;
}

export interface ActorRunStore {
  save(run: ActorRun): Promise<void>;
  get(runId: string): Promise<ActorRun | undefined>;
  lastToken(): Promise<string | undefined>;
}
