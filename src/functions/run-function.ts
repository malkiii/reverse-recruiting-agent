import type { FunctionRunStore, TelegramGateway } from "../lib/gateways";

type RunDeps = { runs: FunctionRunStore; telegram: TelegramGateway; dashboardUrl: string; now: () => Date };

export async function runFunction(runId: number, functionName: string, work: () => Promise<void>, deps: RunDeps) {
  const { runs, telegram, dashboardUrl, now } = deps;
  try {
    await work();
    await runs.finish(runId, { status: "succeeded", finishedAt: now(), error: null });
  } catch (error) {
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
