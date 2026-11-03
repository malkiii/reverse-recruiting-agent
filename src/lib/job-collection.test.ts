import { expect, test } from "vitest";
import { acceptFunctionRequest } from "../functions/accept-function-request";
import {
  FakeActorRunStore,
  FakeFunctionRunStore,
  FakeJobBoard,
  FakeJobBoardSettingsStore,
  FakeJobFeedReader,
  FakeJobFeedStore,
  FakeJobStore,
  FakeSkippedApifyTokenStore,
  FakeTelegram,
} from "./fake-gateways";
import { ApifyTokenUsedUpError } from "./apify-tokens";
import type { CollectedJob } from "./gateways";
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
      jobFeeds: new FakeJobFeedStore(),
      feedReader: new FakeJobFeedReader(),
      apifyTokens,
      skippedApifyTokens: new FakeSkippedApifyTokenStore(),
      telegram: new FakeTelegram(),
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
    Array.from({ length: 30 }, (_, index) => ({
      ...job,
      url: `https://example.com/${runId}/${index}`,
      title: `Job ${runId}/${index}`,
    }));

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
  board.status = async ({ runId }) => (runId === "LinkedIn-run-1" ? "failed" : "succeeded");

  await expect(runCollection(deps)).rejects.toThrow(/LinkedIn-run-1/);

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
      title: `Job ${runId}/${index}`,
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
  const alreadySaved = Array.from({ length: 20 }, (_, index) => ({
    ...job,
    url: `https://example.com/old/${index}`,
    title: `Job old/${index}`,
  }));
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
      : Array.from({ length: 25 }, (_, index) => ({
          ...job,
          url: `https://example.com/new/${index}`,
          title: `Job new/${index}`,
        }));

  await runCollection(deps);

  expect(await deps.jobs.list()).toHaveLength(40);
});

function glassdoorBoard(jobs: CollectedJob[]) {
  return new FakeJobBoard(jobs, "Glassdoor", "valig/glassdoor-jobs-scraper");
}

const glassdoorJob = {
  source: "Glassdoor",
  title: "Backend Engineer",
  companyName: "Globex",
  location: "New York, NY",
  url: "https://www.glassdoor.com/job-listing/j?jl=1",
  description: "<div>Build APIs</div>",
  companyLinkedinUrl: null,
};

test("a Glassdoor Job's post day is calculated from its age in days", async () => {
  const { deps } = setup({ jobs: [] });
  const old = { ...glassdoorJob, url: "https://www.glassdoor.com/job-listing/j?jl=2", ageInDays: 1 };
  const glassdoor = glassdoorBoard([{ ...glassdoorJob, ageInDays: 0 }, old]);
  deps.jobBoards.push(glassdoor);
  await deps.jobBoardSettings.save({ source: "Glassdoor", enabled: true, searches: [search] });

  await runCollection(deps);

  expect(glassdoor.started.map(({ limit }) => limit)).toEqual([20]);
  expect(await deps.jobs.list()).toEqual([{ ...glassdoorJob, postDay: "2026-11-01" }]);
});

test("a Job with the same title, Company and post day on another source is a Duplicate Job", async () => {
  const { deps } = setup();
  const sameJob = { ...glassdoorJob, title: "software engineer", companyName: "ACME", ageInDays: 0 };
  deps.jobBoards.push(glassdoorBoard([sameJob, { ...glassdoorJob, ageInDays: 0 }]));
  await deps.jobBoardSettings.save({ source: "Glassdoor", enabled: true, searches: [search] });

  await runCollection(deps);

  expect(await deps.jobs.list()).toEqual([job, { ...glassdoorJob, postDay: "2026-11-01" }]);
});

const feedUrl = "https://jobs.example.com/search?q=engineer";

const feedJob = {
  source: "Feed: jobs.example.com",
  title: "Platform Engineer",
  companyName: "Initech",
  location: "Remote",
  url: "https://jobs.example.com/jobs/1",
  description: null,
  companyLinkedinUrl: null,
};

test("a Job Feed's Jobs are saved, and one with no post date counts as posted the day it was first seen", async () => {
  const { deps } = setup({ jobs: [] });
  await deps.jobFeeds.add(feedUrl);
  deps.feedReader.jobs.set(feedUrl, [{ ...feedJob, postDay: null }]);

  await runCollection(deps);
  await runCollection({ ...deps, now: () => new Date("2026-11-02T22:00:00Z") });

  expect(deps.feedReader.urlsRead).toEqual([feedUrl, feedUrl]);
  expect(await deps.jobs.list()).toEqual([{ ...feedJob, postDay: "2026-11-01" }]);
});

test("a disabled Job Feed isn't read", async () => {
  const { deps } = setup({ jobs: [] });
  const feed = await deps.jobFeeds.add(feedUrl);
  await deps.jobFeeds.update({ ...feed, enabled: false });
  deps.feedReader.jobs.set(feedUrl, [feedJob]);

  await runCollection(deps);

  expect(deps.feedReader.urlsRead).toEqual([]);
  expect(await deps.jobs.list()).toEqual([]);
});

test("a failing Job Feed doesn't stop the other sources", async () => {
  const { deps } = setup();
  const otherFeed = "https://other.example.com/jobs";
  await deps.jobFeeds.add(feedUrl);
  await deps.jobFeeds.add(otherFeed);
  deps.feedReader.jobs.set(feedUrl, new Error("Firecrawl refused"));
  deps.feedReader.jobs.set(otherFeed, [{ ...feedJob, postDay: "2026-11-01" }]);

  await expect(runCollection(deps)).rejects.toThrow(/Firecrawl refused/);

  expect(await deps.jobs.list()).toEqual([{ ...feedJob, postDay: "2026-11-01" }, job]);
});

test("a disabled Glassdoor Job Board starts no actor run while LinkedIn still runs", async () => {
  const { board, deps } = setup();
  const glassdoor = glassdoorBoard([{ ...glassdoorJob, ageInDays: 0 }]);
  deps.jobBoards.push(glassdoor);
  await deps.jobBoardSettings.save({ source: "Glassdoor", enabled: false, searches: [search] });

  await runCollection(deps);

  expect(glassdoor.started).toEqual([]);
  expect(board.started).toHaveLength(1);
  expect(await deps.jobs.list()).toEqual([job]);
});

test("a failing Glassdoor Job Board doesn't stop LinkedIn or the Job Feeds", async () => {
  const { deps } = setup();
  const glassdoor = glassdoorBoard([{ ...glassdoorJob, ageInDays: 0 }]);
  glassdoor.statuses = ["failed"];
  deps.jobBoards.push(glassdoor);
  await deps.jobBoardSettings.save({ source: "Glassdoor", enabled: true, searches: [search] });
  await deps.jobFeeds.add(feedUrl);
  deps.feedReader.jobs.set(feedUrl, [{ ...feedJob, postDay: "2026-11-01" }]);

  await expect(runCollection(deps)).rejects.toThrow(/Glassdoor-run-1/);

  expect(await deps.jobs.list()).toEqual([{ ...feedJob, postDay: "2026-11-01" }, job]);
});

test("each new Job is sent as its own Job Alert with a button to its page", async () => {
  const other = { ...job, url: "https://www.linkedin.com/jobs/view/2", title: "Data Engineer" };
  const { deps } = setup({ jobs: [job, other] });

  await runCollection(deps);

  expect(deps.telegram.messages).toEqual([
    { text: "Software Engineer at Acme\nRemote · LinkedIn", link: { label: "Open Job", url: job.url } },
    { text: "Data Engineer at Acme\nRemote · LinkedIn", link: { label: "Open Job", url: other.url } },
  ]);
});

test("a Job Collection sends at most 20 Job Alerts, and the rest are never alerted later", async () => {
  const { deps } = setup({ jobs: [] });
  await deps.jobFeeds.add(feedUrl);
  const jobs = Array.from({ length: 25 }, (_, index) => ({
    ...feedJob,
    url: `https://jobs.example.com/jobs/${index}`,
    title: `Job ${index}`,
    postDay: "2026-11-01",
  }));
  deps.feedReader.jobs.set(feedUrl, jobs);

  await runCollection(deps);
  await runCollection(deps);

  expect(deps.telegram.messages.map(({ link }) => link?.url)).toEqual(jobs.slice(0, 20).map(({ url }) => url));
});

test("a Job Alert that failed to send is retried on the next Job Collection and never repeated", async () => {
  const { deps } = setup();
  deps.telegram.failing = true;

  await expect(runCollection(deps)).rejects.toThrow(/Telegram is down/);
  deps.telegram.failing = false;
  await runCollection(deps);
  await runCollection(deps);

  expect(deps.telegram.messages.map(({ link }) => link?.url)).toEqual([job.url]);
});

test("pending Job Alerts from an earlier run come first and share the cap", async () => {
  const { deps } = setup({ jobs: [] });
  await deps.jobFeeds.add(feedUrl);
  const jobs = Array.from({ length: 21 }, (_, index) => ({
    ...feedJob,
    url: `https://jobs.example.com/jobs/${index}`,
    title: `Job ${index}`,
    postDay: "2026-11-01",
  }));
  deps.feedReader.jobs.set(feedUrl, jobs.slice(0, 1));
  deps.telegram.failing = true;
  await expect(runCollection(deps)).rejects.toThrow();

  deps.telegram.failing = false;
  deps.feedReader.jobs.set(feedUrl, jobs.slice(1));
  await runCollection(deps);

  expect(deps.telegram.messages.map(({ link }) => link?.url)).toEqual(jobs.slice(0, 20).map(({ url }) => url));
});

test("a Job Alert that fails to send doesn't stop the others", async () => {
  const other = { ...job, url: "https://www.linkedin.com/jobs/view/2", title: "Data Engineer" };
  const { deps } = setup({ jobs: [job, other] });
  const send = deps.telegram.send.bind(deps.telegram);
  deps.telegram.send = async (text, link) => {
    if (link?.url === job.url) throw new Error("Telegram refused the message: 400");
    await send(text, link);
  };

  await expect(runCollection(deps)).rejects.toThrow(/Telegram refused/);

  expect(deps.telegram.messages.map(({ link }) => link?.url)).toEqual([other.url]);
});

test("when all Apify tokens are used up, the Job Collection fails and the Admin is alerted once", async () => {
  const searches = ["a", "b"].map((keywords) => ({ keywords, location: "Remote" }));
  const { board, deps } = setup({ jobs: [], searches, apifyTokens: "first,second" });
  board.start = async () => {
    throw new ApifyTokenUsedUpError(402);
  };
  await deps.jobFeeds.add(feedUrl);
  deps.feedReader.jobs.set(feedUrl, [{ ...feedJob, postDay: "2026-11-01" }]);

  await expect(runCollection(deps)).rejects.toThrow(/All Apify tokens are used up/);

  expect(deps.telegram.sent).toEqual([
    "All Apify tokens are used up until the next UTC day. Top up a token to collect from Job Boards.",
    "Platform Engineer at Initech\nRemote · Feed: jobs.example.com",
  ]);
});
