import type { FunctionResponse } from "@/functions/accept-function-request";
import { parseDashboardEnv } from "./env";

/**
 * Calls a Function's route, Modal in production and the local worker in dev. 409 means it's already running,
 * and 400 that it was refused, with the reason.
 */
export async function startFunction(functionName: string, body?: unknown) {
  const { FUNCTIONS_BASE_URL, FUNCTIONS_SECRET } = parseDashboardEnv(process.env);
  const response = await fetch(new URL(`/functions/${functionName}`, FUNCTIONS_BASE_URL), {
    method: "POST",
    headers: {
      authorization: `Bearer ${FUNCTIONS_SECRET}`,
      ...(body !== undefined && { "content-type": "application/json" }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  if (!response.ok && response.status !== 409 && response.status !== 400) throw new Error(`The Function was refused: ${response.status}`);
  return (await response.json()) as FunctionResponse;
}
