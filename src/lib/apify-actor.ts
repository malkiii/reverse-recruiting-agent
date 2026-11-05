import type { z } from "zod";
import { ApifyTokenUsedUpError } from "./apify-tokens";
import type { ActorRun, ActorRunStatus } from "./gateways";

const API_URL = "https://api.apify.com/v2";
const STILL_RUNNING = ["READY", "RUNNING", "TIMING-OUT", "ABORTING"];

// 402 is out of credit, 429 is rate-limited.
const isUsedUp = ({ status }: Response) => status === 402 || status === 429;

async function apify<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (isUsedUp(response)) throw new ApifyTokenUsedUpError(response.status);
  if (!response.ok) throw new Error(`Apify request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

/** Starts an actor run without waiting for it, and returns its run ID. */
export async function startActorRun(actor: string, input: unknown, token: string) {
  const { data } = await apify<{ data: { id: string } }>(`/acts/${actor.replace("/", "~")}/runs`, token, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.id;
}

export async function actorRunStatus({ runId, token }: ActorRun): Promise<ActorRunStatus> {
  const { data } = await apify<{ data: { status: string } }>(`/actor-runs/${runId}`, token);
  if (STILL_RUNNING.includes(data.status)) return "running";
  return data.status === "SUCCEEDED" ? "succeeded" : "failed";
}

/** Reads a finished run's items, skipping any item the schema rejects. */
export async function actorRunItems<T, R>(run: ActorRun, itemSchema: z.ZodType<T>, toResult: (item: T) => R): Promise<R[]> {
  const items = await apify<unknown[]>(`/actor-runs/${run.runId}/dataset/items?clean=true`, run.token);

  return items.flatMap((item) => {
    const parsed = itemSchema.safeParse(item);
    if (parsed.success) return [toResult(parsed.data)];
    console.warn(`Skipped a malformed item from actor run ${run.runId}`);
    return [];
  });
}
