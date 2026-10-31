import type { JobBoardGateway, JobStore } from "./gateways";
import { jobSchema } from "./schema";

export async function runCollection({
  jobBoards,
  jobs,
}: {
  jobBoards: JobBoardGateway[];
  jobs: JobStore;
}) {
  for (const jobBoard of jobBoards) {
    await jobs.save(jobSchema.array().parse(await jobBoard.collect()));
  }
}
