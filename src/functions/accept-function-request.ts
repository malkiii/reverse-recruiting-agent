import { safeEqual } from "../lib/auth";
import type { FunctionRunStore } from "../lib/gateways";

type FunctionRequest = { functionName: string; timeLimitMs: number; authorization: string | undefined; body?: unknown };

type AcceptDeps = {
  runs: FunctionRunStore;
  secret: string;
  now: () => Date;
  start: (runId: number, applicationId?: number) => unknown;
  /** Claims the Application the request names. Null when it isn't in a startable state. */
  claim?: (body: unknown) => Promise<number | null>;
};

/** A request body as JSON. Anything else is passed on as text, for the claim to refuse. */
export function parseRequestBody(text: string | undefined): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** The request body doesn't name what the Function should work on. */
export class InvalidFunctionRequestError extends Error {}

export type FunctionResponse =
  | { status: 202; runId: number; applicationId?: number }
  | { status: 400; error: string }
  | { status: 401 }
  | { status: 409 };

/** The route behind every Function, for both the local worker and Modal. It never waits for the work. */
export async function acceptFunctionRequest(
  { functionName, timeLimitMs, authorization, body }: FunctionRequest,
  { runs, secret, now, start, claim }: AcceptDeps,
): Promise<FunctionResponse> {
  if (!safeEqual(authorization ?? "", `Bearer ${secret}`)) return { status: 401 };

  let applicationId: number | undefined;
  if (claim) {
    try {
      const claimed = await claim(body);
      if (claimed === null) return { status: 409 };
      applicationId = claimed;
    } catch (error) {
      if (error instanceof InvalidFunctionRequestError) return { status: 400, error: error.message };
      throw error;
    }
  }

  const runId = await runs.start(functionName, now(), timeLimitMs, applicationId);
  if (runId === null) return { status: 409 };

  start(runId, applicationId);
  return applicationId === undefined ? { status: 202, runId } : { status: 202, runId, applicationId };
}
