import type { ApplicationStatus, ApplicationStep } from "./gateways";
import { APPLICATION_STEPS } from "./schema";

export type StatsRange = "24h" | "7d" | "30d" | "all";

export type StatsRows = {
  jobs: { source: string; foundAt: Date }[];
  applications: { status: ApplicationStatus; currentStep: ApplicationStep; createdAt: Date }[];
  /** When each Recipient's email went out. */
  sentAt: Date[];
};

export type Stats = {
  /** Most first. */
  jobsPerSource: { source: string; count: number }[];
  /** Most first. */
  applicationsByStatus: { status: ApplicationStatus; count: number }[];
  emailsSent: number;
  /** Null when no Application got past the Decision Maker search. */
  emailFoundRate: number | null;
};

const SEARCH_STEP = APPLICATION_STEPS.indexOf("find-decision-makers");
const NOBODY_TO_EMAIL: ApplicationStatus[] = ["no-contacts", "direct-apply"];

type StatsApplication = StatsRows["applications"][number];

const pastSearch = ({ status, currentStep }: StatsApplication) =>
  status === "all-in-cooldown" ||
  NOBODY_TO_EMAIL.includes(status) ||
  APPLICATION_STEPS.indexOf(currentStep) > SEARCH_STEP;

function emailFoundRate(applications: StatsApplication[]) {
  const searched = applications.filter(pastSearch);
  if (searched.length === 0) return null;
  return searched.filter(({ status }) => !NOBODY_TO_EMAIL.includes(status)).length / searched.length;
}

const HOUR_MS = 60 * 60 * 1000;
const RANGE_MS: Record<StatsRange, number> = {
  "24h": 24 * HOUR_MS,
  "7d": 7 * 24 * HOUR_MS,
  "30d": 30 * 24 * HOUR_MS,
  all: Number.POSITIVE_INFINITY,
};

/** How many of each key, most first. */
function countBy<Key extends string>(keys: Key[]) {
  const counts = new Map<Key, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts].sort(([, a], [, b]) => b - a);
}

const inRange = (range: StatsRange, now: Date) => (date: Date) => now.getTime() - date.getTime() < RANGE_MS[range];

export function stats(rows: StatsRows, range: StatsRange, now: Date): Stats {
  const within = inRange(range, now);
  const applications = rows.applications.filter(({ createdAt }) => within(createdAt));
  return {
    jobsPerSource: countBy(rows.jobs.filter(({ foundAt }) => within(foundAt)).map(({ source }) => source)).map(
      ([source, count]) => ({ source, count }),
    ),
    applicationsByStatus: countBy(applications.map(({ status }) => status)).map(([status, count]) => ({ status, count })),
    emailsSent: rows.sentAt.filter(within).length,
    emailFoundRate: emailFoundRate(applications),
  };
}

export type JobsStrip = { newJobsToday: number; inReview: number; sentThisWeek: number; emailFoundRate: number | null };

/** The calendar day a moment falls on in the timezone, as YYYY-MM-DD. */
const dayIn = (date: Date, timeZone: string) => date.toLocaleDateString("en-CA", { timeZone });

/** The numbers at the top of Jobs. "Today" starts at midnight in the Admin's timezone. */
export function jobsStrip(rows: StatsRows, now: Date, timeZone: string): JobsStrip {
  const today = dayIn(now, timeZone);
  const lastMonth = stats(rows, "30d", now);
  return {
    newJobsToday: rows.jobs.filter(({ foundAt }) => dayIn(foundAt, timeZone) === today).length,
    inReview: rows.applications.filter(({ status }) => status === "in-review").length,
    sentThisWeek: stats(rows, "7d", now).emailsSent,
    emailFoundRate: lastMonth.emailFoundRate,
  };
}

export const STATS_RANGES = ["24h", "7d", "30d", "all"] as const satisfies StatsRange[];

/** The range in the URL, 30d when it's missing or unknown. */
export const parseRange = (value: string | undefined): StatsRange =>
  STATS_RANGES.find((range) => range === value) ?? "30d";

export const STATUS_GROUPS = ["in-review", "working", "sent", "failed", "other"] as const;
export type StatusGroup = (typeof STATUS_GROUPS)[number];
export type StatusFilter = StatusGroup | "all";

const GROUP_OF: Record<ApplicationStatus, StatusGroup> = {
  preparing: "working",
  sending: "working",
  "in-review": "in-review",
  sent: "sent",
  failed: "failed",
  cancelled: "other",
  "no-contacts": "other",
  "direct-apply": "other",
  "all-in-cooldown": "other",
};

export const statusGroup = (status: ApplicationStatus) => GROUP_OF[status];

/** The status filter in the URL, all when it's missing or unknown. */
export const parseStatusFilter = (value: string | undefined): StatusFilter =>
  STATUS_GROUPS.find((group) => group === value) ?? "all";

/** How many Applications each status filter shows. */
export function groupCounts(statuses: ApplicationStatus[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = { all: statuses.length, "in-review": 0, working: 0, sent: 0, failed: 0, other: 0 };
  for (const status of statuses) counts[statusGroup(status)] += 1;
  return counts;
}
