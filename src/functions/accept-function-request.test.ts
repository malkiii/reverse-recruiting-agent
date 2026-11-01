import { expect, test } from "vitest";
import { FakeFunctionRunStore } from "../lib/fake-gateways";
import { acceptFunctionRequest } from "./accept-function-request";

function setup(start: (runId: number) => void = () => {}) {
  return { runs: new FakeFunctionRunStore(), secret: "secret", now: () => new Date("2026-11-01T12:00:00Z"), start };
}

test("a missing bearer secret is rejected and nothing runs", async () => {
  const deps = setup(() => expect.unreachable());

  const response = await acceptFunctionRequest({ functionName: "noop", authorization: undefined }, deps);

  expect(response).toEqual({ status: 401 });
  expect(await deps.runs.list()).toEqual([]);
});

test("a wrong bearer secret is rejected and nothing runs", async () => {
  const deps = setup(() => expect.unreachable());

  const response = await acceptFunctionRequest({ functionName: "noop", authorization: "Bearer wrong" }, deps);

  expect(response).toEqual({ status: 401 });
  expect(await deps.runs.list()).toEqual([]);
});

test("the right bearer secret records a running Function run and starts it", async () => {
  const started: number[] = [];
  const deps = setup((runId) => started.push(runId));

  const response = await acceptFunctionRequest({ functionName: "noop", authorization: "Bearer secret" }, deps);

  expect(response).toEqual({ status: 202, runId: 1 });
  expect(started).toEqual([1]);
  expect(await deps.runs.list()).toMatchObject([
    { id: 1, functionName: "noop", status: "running", startedAt: new Date("2026-11-01T12:00:00Z"), finishedAt: null },
  ]);
});

test("the request returns without waiting for the Function to finish", async () => {
  const neverFinishes = new Promise<void>(() => {});
  const deps = setup(() => neverFinishes);

  const response = await acceptFunctionRequest({ functionName: "noop", authorization: "Bearer secret" }, deps);

  expect(response.status).toBe(202);
});
