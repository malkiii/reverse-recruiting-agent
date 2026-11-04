import { expect, test } from "vitest";
import { FakeFunctionRunStore } from "../lib/fake-gateways";
import { acceptFunctionRequest, InvalidFunctionRequestError } from "./accept-function-request";

function setup(start: (runId: number) => void = () => {}) {
  return { runs: new FakeFunctionRunStore(), secret: "secret", now: () => new Date("2026-11-01T12:00:00Z"), start };
}

test("a missing bearer secret is rejected and nothing runs", async () => {
  const deps = setup(() => expect.unreachable());

  const response = await acceptFunctionRequest({ functionName: "noop", timeLimitMs: 60_000, authorization: undefined }, deps);

  expect(response).toEqual({ status: 401 });
  expect(await deps.runs.list()).toEqual([]);
});

test("a wrong bearer secret is rejected and nothing runs", async () => {
  const deps = setup(() => expect.unreachable());

  const response = await acceptFunctionRequest({ functionName: "noop", timeLimitMs: 60_000, authorization: "Bearer wrong" }, deps);

  expect(response).toEqual({ status: 401 });
  expect(await deps.runs.list()).toEqual([]);
});

test("the right bearer secret records a running Function run and starts it", async () => {
  const started: number[] = [];
  const deps = setup((runId) => started.push(runId));

  const response = await acceptFunctionRequest({ functionName: "noop", timeLimitMs: 60_000, authorization: "Bearer secret" }, deps);

  expect(response).toEqual({ status: 202, runId: 1 });
  expect(started).toEqual([1]);
  expect(await deps.runs.list()).toMatchObject([
    { id: 1, functionName: "noop", status: "running", startedAt: new Date("2026-11-01T12:00:00Z"), finishedAt: null },
  ]);
});

test("the request returns without waiting for the Function to finish", async () => {
  const neverFinishes = new Promise<void>(() => {});
  const deps = setup(() => neverFinishes);

  const response = await acceptFunctionRequest({ functionName: "noop", timeLimitMs: 60_000, authorization: "Bearer secret" }, deps);

  expect(response.status).toBe(202);
});

test("a claimed Application is recorded on the Function run and passed to the Function", async () => {
  const started: [number, number | undefined][] = [];
  const deps = { ...setup(), start: (runId: number, applicationId?: number) => started.push([runId, applicationId]) };
  const claim = async (body: unknown) => ((body as { jobId: number }).jobId === 7 ? 3 : null);

  const response = await acceptFunctionRequest(
    { functionName: "prepare-application", timeLimitMs: 60_000, authorization: "Bearer secret", body: { jobId: 7 } },
    { ...deps, claim },
  );

  expect(response).toEqual({ status: 202, runId: 1, applicationId: 3 });
  expect(started).toEqual([[1, 3]]);
  expect(await deps.runs.list()).toMatchObject([{ functionName: "prepare-application", applicationId: 3 }]);
});

test("a refused claim answers 409 and nothing runs", async () => {
  const deps = setup(() => expect.unreachable());

  const response = await acceptFunctionRequest(
    { functionName: "prepare-application", timeLimitMs: 60_000, authorization: "Bearer secret", body: { jobId: 7 } },
    { ...deps, claim: async () => null },
  );

  expect(response).toEqual({ status: 409 });
  expect(await deps.runs.list()).toEqual([]);
});

test("a malformed request body answers 400 and nothing runs", async () => {
  const deps = setup(() => expect.unreachable());

  const response = await acceptFunctionRequest(
    { functionName: "prepare-application", timeLimitMs: 60_000, authorization: "Bearer secret", body: "nonsense" },
    { ...deps, claim: async () => { throw new InvalidFunctionRequestError("jobId is required"); } },
  );

  expect(response).toEqual({ status: 400, error: "jobId is required" });
});
