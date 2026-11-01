import { safeEqual } from "../lib/auth";
import type { FunctionRunStore } from "../lib/gateways";

type FunctionRequest = { functionName: string; timeLimitMs: number; authorization: string | undefined };

type AcceptDeps = {
  runs: FunctionRunStore;
  secret: string;
  now: () => Date;
  start: (runId: number) => unknown;
};

export type FunctionResponse = { status: 202; runId: number } | { status: 401 } | { status: 409 };

/** The route behind every Function, for both the local worker and Modal. It never waits for the work. */
export async function acceptFunctionRequest(
  { functionName, timeLimitMs, authorization }: FunctionRequest,
  { runs, secret, now, start }: AcceptDeps,
): Promise<FunctionResponse> {
  if (!safeEqual(authorization ?? "", `Bearer ${secret}`)) return { status: 401 };

  const runId = await runs.start(functionName, now(), timeLimitMs);
  if (runId === null) return { status: 409 };

  start(runId);
  return { status: 202, runId };
}
