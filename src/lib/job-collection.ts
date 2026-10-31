import type { JobBoardGateway, JobStore } from "./gateways";

export async function runCollection({
  jobBoards,
  jobs,
}: {
  jobBoards: JobBoardGateway[];
  jobs: JobStore;
}) {
  for (const jobBoard of jobBoards) {
    await jobs.save(await jobBoard.collect());
  }
}
