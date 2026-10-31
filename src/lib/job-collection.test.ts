import { expect, test } from "vitest";
import { FakeActorRunStore, FakeJobBoard, FakeJobBoardSettingsStore, FakeJobStore } from "./fake-gateways";
import { resumeCollection, runCollection } from "./job-collection";

const now = new Date("2026-10-31T12:00:00Z");

const job = {
  source: "LinkedIn",
  title: "Software Engineer",
  companyName: "Acme",
  location: "Remote",
  url: "https://example.com/jobs/1",
  postDay: "2026-10-31",
  description: null,
};

const enabled = { source: "LinkedIn", enabled: true, searchUrls: ["https://www.linkedin.com/jobs/search/?keywords=a"] };

function setup(collected: unknown[], settings = enabled, apifyTokens = "token") {
  const board = new FakeJobBoard(collected as (typeof job)[]);
  return {
    board,
    deps: {
      jobBoards: [board],
      jobBoardSettings: new FakeJobBoardSettingsStore([settings]),
      actorRuns: new FakeActorRunStore(),
      jobs: new FakeJobStore(),
      apifyTokens,
      now,
    },
  };
}

async function collect({ deps, board }: ReturnType<typeof setup>) {
  await runCollection(deps);
  await resumeCollection({ ...deps, runId: board.started.at(-1)!.runId });
}

test("a resumed collection run saves the Jobs found on a Job Board", async () => {
  const run = setup([job]);

  await collect(run);

  expect(await run.deps.jobs.list()).toEqual([job]);
});

test("a malformed Job is rejected and nothing is saved", async () => {
  const run = setup([{ ...job, title: null }]);

  await expect(collect(run)).rejects.toThrow();

  expect(await run.deps.jobs.list()).toEqual([]);
});

test("a disabled Job Board starts no actor run", async () => {
  const run = setup([job], { ...enabled, enabled: false });

  await runCollection(run.deps);

  expect(run.board.started).toEqual([]);
});

test("a Job Board with no search URLs starts no actor run", async () => {
  const run = setup([job], { ...enabled, searchUrls: [] });

  await runCollection(run.deps);

  expect(run.board.started).toEqual([]);
});

test("only Jobs posted today are saved", async () => {
  const yesterday = { ...job, url: "https://example.com/jobs/old", postDay: "2026-10-30" };
  const run = setup([yesterday, job]);

  await collect(run);

  expect(await run.deps.jobs.list()).toEqual([job]);
});

test("a run saves at most 50 Jobs", async () => {
  const collected = Array.from({ length: 51 }, (_, index) => ({ ...job, url: `https://example.com/jobs/${index}` }));
  const run = setup(collected);

  await collect(run);

  expect(await run.deps.jobs.list()).toHaveLength(50);
});

test("a Job with an already-saved URL is a Duplicate Job", async () => {
  const run = setup([job]);

  await collect(run);
  await collect(run);

  expect(await run.deps.jobs.list()).toEqual([job]);
});

test("a repeated webhook causes no duplicates", async () => {
  const run = setup([job]);

  await collect(run);
  await resumeCollection({ ...run.deps, runId: run.board.started[0]!.runId });

  expect(await run.deps.jobs.list()).toEqual([job]);
});

test("a webhook for an unknown actor run saves nothing", async () => {
  const run = setup([job]);

  await resumeCollection({ ...run.deps, runId: "unknown" });

  expect(await run.deps.jobs.list()).toEqual([]);
});

test("tokens rotate round-robin and each actor run stores the token that started it", async () => {
  const run = setup([job], enabled, " first, second,");

  for (let index = 0; index < 3; index++) await runCollection(run.deps);

  expect(run.board.started.map(({ token }) => token)).toEqual(["first", "second", "first"]);
  const stored = await run.deps.actorRuns.get(run.board.started[1]!.runId);
  expect(stored?.token).toBe("second");
});

test("a run with no Apify tokens fails before starting an actor", async () => {
  const run = setup([job], enabled, " , ");

  await expect(runCollection(run.deps)).rejects.toThrow();

  expect(run.board.started).toEqual([]);
});

test("a run resumed after midnight keeps the Jobs posted on the day it started", async () => {
  const lastNight = { ...job, postDay: "2026-10-30" };
  const run = setup([lastNight]);

  await runCollection({ ...run.deps, now: new Date("2026-10-30T23:59:00Z") });
  await resumeCollection({ ...run.deps, runId: run.board.started[0]!.runId });

  expect(await run.deps.jobs.list()).toEqual([lastNight]);
});
