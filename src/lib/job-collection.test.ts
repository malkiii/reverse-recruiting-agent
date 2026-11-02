import { expect, test } from "vitest";
import { acceptFunctionRequest } from "../functions/accept-function-request";
import {
  FakeActorRunStore,
  FakeFunctionRunStore,
  FakeJobBoard,
  FakeJobBoardSettingsStore,
  FakeJobStore,
} from "./fake-gateways";
import { COLLECTION_TIME_LIMIT_MS, runCollection } from "./job-collection";
import { COLLECT_JOBS } from "./schema";

const now = new Date("2026-11-01T22:00:00Z");

const job = {
  source: "LinkedIn",
  title: "Software Engineer",
  companyName: "Acme",
  location: "Remote",
  url: "https://www.linkedin.com/jobs/view/1",
  postDay: "2026-11-01",
  description: "Build things",
  companyLinkedinUrl: "https://www.linkedin.com/company/acme",
};

const search = { keywords: "engineer", location: "Remote" };

function setup({ jobs = [job], enabled = true, searches = [search], apifyTokens = "token" } = {}) {
  const board = new FakeJobBoard(jobs);
  const delays: number[] = [];
  return {
    board,
    delays,
    deps: {
      jobBoards: [board],
      jobBoardSettings: new FakeJobBoardSettingsStore([{ source: board.source, enabled, searches }]),
      actorRuns: new FakeActorRunStore(),
      jobs: new FakeJobStore(),
      apifyTokens,
      now: () => now,
      sleep: async (ms: number) => void delays.push(ms),
    },
  };
}

test("a Job Collection saves the Jobs found, with the Company's LinkedIn page", async () => {
  const { deps } = setup();

  await runCollection(deps);

  expect(await deps.jobs.list()).toEqual([job]);
});

test("a disabled Job Board starts no actor run", async () => {
  const { board, deps } = setup({ enabled: false });

  await runCollection(deps);

  expect(board.started).toEqual([]);
  expect(await deps.jobs.list()).toEqual([]);
});

test("only Jobs posted today are saved", async () => {
  const yesterday = { ...job, url: "https://www.linkedin.com/jobs/view/2", postDay: "2026-10-31" };
  const { deps } = setup({ jobs: [yesterday, job] });

  await runCollection(deps);

  expect(await deps.jobs.list()).toEqual([job]);
});

test("a Job with an already-saved URL is a Duplicate Job", async () => {
  const { deps } = setup();

  await runCollection(deps);
  await runCollection(deps);

  expect(await deps.jobs.list()).toEqual([job]);
});

test("searches share the limit and a Job Collection saves at most 20 Jobs", async () => {
  const searches = ["a", "b", "c"].map((keywords) => ({ keywords, location: "Remote" }));
  const { board, deps } = setup({ searches });
  board.results = async ({ runId }) =>
    Array.from({ length: 30 }, (_, index) => ({ ...job, url: `https://example.com/${runId}/${index}` }));

  await runCollection(deps);

  expect(board.started.map(({ limit }) => limit)).toEqual([7, 7, 6]);
  expect(await deps.jobs.list()).toHaveLength(20);
});

test("an actor run is polled with a delay until it finishes", async () => {
  const { board, delays, deps } = setup();
  board.statuses = ["running", "running", "succeeded"];

  await runCollection(deps);

  expect(delays).toHaveLength(2);
  expect(await deps.jobs.list()).toEqual([job]);
});

test("an unfinished actor run is saved with its own token and no replacement is started", async () => {
  const { board, deps } = setup();
  const tokens: string[] = [];
  board.results = async ({ token }) => {
    tokens.push(token);
    return [job];
  };
  await deps.actorRuns.save({
    runId: "left-over",
    actor: board.actor,
    token: "old-token",
    search,
    startedAt: new Date("2026-11-01T21:00:00Z"),
  });

  await runCollection(deps);

  expect(board.started).toEqual([]);
  expect(tokens).toEqual(["old-token"]);
  expect(await deps.jobs.list()).toEqual([job]);
  expect(await deps.actorRuns.listUnfinished()).toEqual([]);
});

test("an actor run left from an earlier day keeps that day's Jobs and today's search still runs", async () => {
  const lastNight = { ...job, url: "https://www.linkedin.com/jobs/view/2", postDay: "2026-10-31" };
  const { board, deps } = setup({ jobs: [lastNight, job] });
  await deps.actorRuns.save({
    runId: "left-over",
    actor: board.actor,
    token: "token",
    search,
    startedAt: new Date("2026-10-31T22:00:00Z"),
  });

  await runCollection(deps);

  expect(board.started).toHaveLength(1);
  expect(await deps.jobs.list()).toEqual([lastNight, job]);
});

test("an actor run still going after polling stops is left for the next Job Collection", async () => {
  const { board, deps } = setup();
  board.statuses = ["running"];

  await runCollection(deps);

  expect(await deps.jobs.list()).toEqual([]);
  expect(await deps.actorRuns.listUnfinished()).toHaveLength(1);

  board.statuses = ["succeeded"];
  await runCollection(deps);

  expect(board.started).toHaveLength(1);
  expect(await deps.jobs.list()).toEqual([job]);
});

test("a failed actor run is closed and reported, and the other searches are still saved", async () => {
  const searches = ["a", "b"].map((keywords) => ({ keywords, location: "Remote" }));
  const { board, deps } = setup({ searches });
  board.status = async ({ runId }) => (runId === "run-1" ? "failed" : "succeeded");

  await expect(runCollection(deps)).rejects.toThrow(/run-1/);

  expect(await deps.jobs.list()).toEqual([job]);
  expect(await deps.actorRuns.listUnfinished()).toEqual([]);
});

test("a search that can't start doesn't stop the others", async () => {
  const searches = ["a", "b"].map((keywords) => ({ keywords, location: "Remote" }));
  const { board, deps } = setup({ searches });
  const start = board.start.bind(board);
  board.start = async (search, limit, token) => {
    if (search.keywords === "a") throw new Error("Apify refused");
    return start(search, limit, token);
  };

  await expect(runCollection(deps)).rejects.toThrow(/Apify refused/);

  expect(await deps.jobs.list()).toEqual([job]);
});

test("tokens rotate round-robin and each actor run stores the token that started it", async () => {
  const searches = ["a", "b", "c"].map((keywords) => ({ keywords, location: "Remote" }));
  const { board, deps } = setup({ searches, apifyTokens: " first, second," });
  const stored: string[] = [];
  const save = deps.actorRuns.save.bind(deps.actorRuns);
  deps.actorRuns.save = async (run) => {
    stored.push(run.token);
    await save(run);
  };

  await runCollection(deps);

  expect(board.started.map(({ token }) => token)).toEqual(["first", "second", "first"]);
  expect(stored).toEqual(["first", "second", "first"]);
});

test("a Job Collection with no Apify tokens fails before starting an actor", async () => {
  const { board, deps } = setup({ apifyTokens: " , " });

  await expect(runCollection(deps)).rejects.toThrow(/Apify tokens/);

  expect(board.started).toEqual([]);
});

function requestCollection(runs: FakeFunctionRunStore, at: Date, start: () => void) {
  return acceptFunctionRequest(
    { functionName: COLLECT_JOBS, authorization: "Bearer secret", timeLimitMs: COLLECTION_TIME_LIMIT_MS },
    { runs, secret: "secret", now: () => at, start },
  );
}

test("a Job Collection isn't started while one is active", async () => {
  const runs = new FakeFunctionRunStore();
  await requestCollection(runs, now, () => {});

  const response = await requestCollection(runs, now, () => expect.unreachable());

  expect(response).toEqual({ status: 409 });
  expect(await runs.list()).toHaveLength(1);
});

test("a Job Collection past its time limit doesn't block the next one", async () => {
  const runs = new FakeFunctionRunStore();
  await requestCollection(runs, now, () => {});

  const later = new Date(now.getTime() + COLLECTION_TIME_LIMIT_MS);
  const response = await requestCollection(runs, later, () => {});

  expect(response).toEqual({ status: 202, runId: 2 });
  expect(await runs.list()).toMatchObject([{ status: "failed", finishedAt: later }, { status: "running" }]);
});

test("a large actor run left from an earlier day doesn't use up today's cap", async () => {
  const { board, deps } = setup();
  board.results = async ({ runId, startedAt }) =>
    Array.from({ length: 50 }, (_, index) => ({
      ...job,
      url: `https://example.com/${runId}/${index}`,
      postDay: startedAt.toISOString().slice(0, 10),
    }));
  await deps.actorRuns.save({
    runId: "left-over",
    actor: board.actor,
    token: "token",
    search,
    startedAt: new Date("2026-10-31T22:00:00Z"),
  });

  await runCollection(deps);

  expect(await deps.jobs.list()).toHaveLength(40);
});

test("Jobs that were already saved don't count towards the cap", async () => {
  const searches = ["a", "b"].map((keywords) => ({ keywords, location: "Remote" }));
  const { board, deps } = setup({ searches });
  const alreadySaved = Array.from({ length: 20 }, (_, index) => ({ ...job, url: `https://example.com/old/${index}` }));
  await deps.jobs.save(alreadySaved);
  await deps.actorRuns.save({
    runId: "left-over",
    actor: board.actor,
    token: "token",
    search: searches[0],
    startedAt: new Date("2026-11-01T21:00:00Z"),
  });
  await deps.actorRuns.save({
    runId: "left-over-2",
    actor: board.actor,
    token: "token",
    search: searches[1],
    startedAt: new Date("2026-11-01T21:00:00Z"),
  });
  board.results = async ({ runId }) =>
    runId === "left-over"
      ? alreadySaved
      : Array.from({ length: 25 }, (_, index) => ({ ...job, url: `https://example.com/new/${index}` }));

  await runCollection(deps);

  expect(await deps.jobs.list()).toHaveLength(40);
});
