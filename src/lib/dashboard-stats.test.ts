import { expect, test } from "vitest";
import { groupCounts, jobsStrip, parseRange, parseStatusFilter, stats, type StatsRows } from "./dashboard-stats";

const now = new Date("2026-11-06T12:00:00Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);
const daysAgo = (days: number) => hoursAgo(days * 24);

const rows = (overrides: Partial<StatsRows>): StatsRows => ({ jobs: [], applications: [], sentAt: [], ...overrides });

test("Email-Found Rate counts only Applications that got past the Decision Maker search", () => {
  const result = stats(
    rows({
      applications: [
        // Past the search: found.
        { status: "in-review", currentStep: "check-sharing", createdAt: daysAgo(1) },
        { status: "sent", currentStep: "send", createdAt: daysAgo(1) },
        // Ended without anyone to email.
        { status: "no-contacts", currentStep: "find-decision-makers", createdAt: daysAgo(1) },
        { status: "direct-apply", currentStep: "find-company-page", createdAt: daysAgo(1) },
        // Emails existed, everyone was in Cooldown.
        { status: "all-in-cooldown", currentStep: "find-decision-makers", createdAt: daysAgo(1) },
        // Failed before the search ended: says nothing about emails.
        { status: "failed", currentStep: "find-decision-makers", createdAt: daysAgo(1) },
        { status: "preparing", currentStep: "read-job", createdAt: daysAgo(1) },
      ],
    }),
    "30d",
    now,
  );

  expect(result.emailFoundRate).toBe(3 / 5);
});

test("Email-Found Rate is empty when no Application in the range got past the search", () => {
  const result = stats(
    rows({ applications: [{ status: "sent", currentStep: "send", createdAt: daysAgo(8) }] }),
    "7d",
    now,
  );

  expect(result.emailFoundRate).toBeNull();
});

test("Jobs per source counts each Job Board and Job Feed found in the range, most first", () => {
  const result = stats(
    rows({
      jobs: [
        { source: "LinkedIn", foundAt: hoursAgo(2) },
        { source: "Feed: wellfound.com", foundAt: hoursAgo(3) },
        { source: "Feed: wellfound.com", foundAt: hoursAgo(20) },
        { source: "Glassdoor", foundAt: hoursAgo(30) },
      ],
    }),
    "24h",
    now,
  );

  expect(result.jobsPerSource).toEqual([
    { source: "Feed: wellfound.com", count: 2 },
    { source: "LinkedIn", count: 1 },
  ]);
});

test("Applications by status and emails sent count only what happened in the range", () => {
  const result = stats(
    rows({
      applications: [
        { status: "sent", currentStep: "send", createdAt: daysAgo(2) },
        { status: "sent", currentStep: "send", createdAt: daysAgo(3) },
        { status: "in-review", currentStep: "check-sharing", createdAt: daysAgo(1) },
        { status: "failed", currentStep: "read-job", createdAt: daysAgo(9) },
      ],
      sentAt: [daysAgo(2), daysAgo(2), daysAgo(3), daysAgo(10)],
    }),
    "7d",
    now,
  );

  expect(result.applicationsByStatus).toEqual([
    { status: "sent", count: 2 },
    { status: "in-review", count: 1 },
  ]);
  expect(result.emailsSent).toBe(3);
});

test("All counts everything ever recorded", () => {
  const result = stats(rows({ sentAt: [daysAgo(400), daysAgo(1)] }), "all", now);

  expect(result.emailsSent).toBe(2);
});

test("The Jobs strip counts Jobs found since midnight in the Admin's timezone", () => {
  const strip = jobsStrip(
    rows({
      jobs: [
        // 00:30 on 6 November in Algiers (UTC+1).
        { source: "LinkedIn", foundAt: new Date("2026-11-05T23:30:00Z") },
        // 23:30 on 5 November in Algiers.
        { source: "LinkedIn", foundAt: new Date("2026-11-05T22:30:00Z") },
      ],
    }),
    now,
    "Africa/Algiers",
  );

  expect(strip.newJobsToday).toBe(1);
});

test("The Jobs strip shows every Application In Review, emails sent this week and the 30-day Email-Found Rate", () => {
  const strip = jobsStrip(
    rows({
      applications: [
        { status: "in-review", currentStep: "check-sharing", createdAt: daysAgo(40) },
        { status: "in-review", currentStep: "check-sharing", createdAt: daysAgo(1) },
        { status: "no-contacts", currentStep: "find-decision-makers", createdAt: daysAgo(35) },
      ],
      sentAt: [daysAgo(1), daysAgo(6), daysAgo(8)],
    }),
    now,
    "UTC",
  );

  expect(strip).toEqual({ newJobsToday: 0, inReview: 2, sentThisWeek: 2, emailFoundRate: 1 });
});

test("Each status filter counts its Applications, Working and Other grouping several statuses", () => {
  expect(
    groupCounts(["preparing", "sending", "in-review", "sent", "failed", "cancelled", "no-contacts", "direct-apply", "all-in-cooldown"]),
  ).toEqual({ all: 9, "in-review": 1, working: 2, sent: 1, failed: 1, other: 4 });
});

test("An unknown status filter or range in the URL falls back to the default", () => {
  expect(parseStatusFilter("working")).toBe("working");
  expect(parseStatusFilter("bogus")).toBe("all");
  expect(parseStatusFilter(undefined)).toBe("all");
  expect(parseRange("24h")).toBe("24h");
  expect(parseRange("1y")).toBe("30d");
});
