import type { z } from "zod";
import type { jobSchema } from "./schema";

export type Job = z.infer<typeof jobSchema>;

export interface JobBoardGateway {
  collect(): Promise<Job[]>;
}

export interface JobStore {
  save(jobs: Job[]): Promise<void>;
  list(): Promise<Job[]>;
}
