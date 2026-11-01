import type { FunctionRunStore } from "../lib/gateways";

type RunDeps = { runs: FunctionRunStore; now: () => Date };

export async function runFunction(runId: number, work: () => Promise<void>, { runs, now }: RunDeps) {
  try {
    await work();
    await runs.finish(runId, { status: "succeeded", finishedAt: now(), error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await runs.finish(runId, { status: "failed", finishedAt: now(), error: message });
  }
}
