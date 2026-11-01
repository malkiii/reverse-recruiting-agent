import { drizzleFunctionRunStore } from "../lib/drizzle";
import { parseFunctionsEnv } from "../lib/env";

export const functions = new Map<string, () => Promise<void>>([["noop", async () => {}]]);

export function functionServices() {
  const { DATABASE_URL, FUNCTIONS_SECRET } = parseFunctionsEnv(process.env);
  return {
    runs: drizzleFunctionRunStore(DATABASE_URL),
    secret: FUNCTIONS_SECRET,
    now: () => new Date(),
  };
}
