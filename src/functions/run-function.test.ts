import { expect, test } from "vitest";
import { FakeFunctionRunStore } from "../lib/fake-gateways";
import { runFunction } from "./run-function";

const startedAt = new Date("2026-11-01T12:00:00Z");
const finishedAt = new Date("2026-11-01T12:00:05Z");

async function setup() {
  const runs = new FakeFunctionRunStore();
  const runId = await runs.start("noop", startedAt);
  return { runs, runId, now: () => finishedAt };
}

test("a finished Function is recorded as succeeded with its finish time", async () => {
  const { runId, ...deps } = await setup();

  await runFunction(runId, async () => {}, deps);

  expect(await deps.runs.list()).toMatchObject([{ status: "succeeded", startedAt, finishedAt, error: null }]);
});

test("a Function that throws is recorded as failed with its error", async () => {
  const { runId, ...deps } = await setup();

  await runFunction(runId, async () => { throw new Error("boom"); }, deps);

  expect(await deps.runs.list()).toMatchObject([{ status: "failed", finishedAt, error: "boom" }]);
});
