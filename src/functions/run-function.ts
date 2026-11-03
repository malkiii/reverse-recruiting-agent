import type { FunctionRunStore, TelegramGateway } from "../lib/gateways";

type RunDeps = { runs: FunctionRunStore; telegram: TelegramGateway; dashboardUrl: string; now: () => Date };

export async function runFunction(runId: number, functionName: string, work: () => Promise<void>, deps: RunDeps) {
  const { runs, telegram, dashboardUrl, now } = deps;
  const startedAt = now();
  const elapsed = () => `${Math.round((now().getTime() - startedAt.getTime()) / 1000)}s`;
  console.log(`Function ${functionName} run ${runId} started`);
  try {
    await work();
    await runs.finish(runId, { status: "succeeded", finishedAt: now(), error: null });
    console.log(`Function ${functionName} run ${runId} succeeded after ${elapsed()}`);
  } catch (error) {
    console.error(`Function ${functionName} run ${runId} failed after ${elapsed()}:`, error);
    const message = error instanceof Error ? error.message : String(error);
    try {
      await runs.finish(runId, { status: "failed", finishedAt: now(), error: message });
    } finally {
      const link = new URL("/function-runs", dashboardUrl);
      // A Telegram outage only costs the alert, and must not replace the failure itself.
      await telegram.send(`Function ${functionName} failed: ${link}`).catch(console.error);
    }
  }
}
