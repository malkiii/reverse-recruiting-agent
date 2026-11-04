import { expect, test } from "vitest";
import type { FunctionRun } from "./gateways";
import { runAsOf } from "./function-runs";

const startedAt = new Date("2026-11-01T12:00:00Z");
const run: FunctionRun = {
  id: 1,
  functionName: "noop",
  status: "running",
  startedAt,
  finishedAt: null,
  error: null,
  applicationId: null,
};

test("a running Function past its time limit shows as failed", () => {
  const now = new Date("2026-11-01T12:01:00Z");

  expect(runAsOf(run, now)).toMatchObject({
    status: "failed",
    finishedAt: new Date("2026-11-01T12:01:00Z"),
    error: "Passed its time limit",
  });
});

test("a running Function inside its time limit shows as running", () => {
  const now = new Date("2026-11-01T12:00:59Z");

  expect(runAsOf(run, now)).toEqual(run);
});

test("a finished Function keeps its result after the time limit", () => {
  const finished: FunctionRun = { ...run, status: "succeeded", finishedAt: startedAt };
  const now = new Date("2026-11-01T13:00:00Z");

  expect(runAsOf(finished, now)).toEqual(finished);
});
