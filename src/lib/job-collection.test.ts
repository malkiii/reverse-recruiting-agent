import { expect, test } from "vitest";
import { FakeJobBoard, FakeJobStore } from "./fake-gateways";
import { runCollection } from "./job-collection";

const job = {
  source: "LinkedIn",
  title: "Software Engineer",
  companyName: "Acme",
  location: "Remote",
  url: "https://example.com/jobs/1",
  postDay: "2026-10-31",
  description: null,
};

test("run collection saves the Jobs found on a Job Board", async () => {
  const jobs = new FakeJobStore();

  await runCollection({ jobBoards: [new FakeJobBoard([job])], jobs });

  expect(await jobs.list()).toEqual([job]);
});
