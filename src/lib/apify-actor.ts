import type { z } from "zod";
import type { ActorRun, ActorRunStatus, CollectedJob } from "./gateways";

const API_URL = "https://api.apify.com/v2";
const STILL_RUNNING = ["READY", "RUNNING", "TIMING-OUT", "ABORTING"];

async function apify<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
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

/** Reads a finished run's Jobs, skipping any item the schema rejects. */
export async function actorRunJobs<T>(
  run: ActorRun,
  itemSchema: z.ZodType<T>,
  toJob: (item: T) => CollectedJob,
): Promise<CollectedJob[]> {
  const items = await apify<unknown[]>(`/actor-runs/${run.runId}/dataset/items?clean=true`, run.token);

  return items.flatMap((item) => {
    const parsed = itemSchema.safeParse(item);
    if (parsed.success) return [toJob(parsed.data)];
    console.warn(`Skipped a malformed Job from actor run ${run.runId}`);
    return [];
  });
}
