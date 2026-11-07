import { statusGroup, type StatusFilter, type StatusGroup } from "@/lib/dashboard-stats";
import { FEED_SOURCE_PREFIX } from "@/lib/firecrawl-job-feed";
import type { ApplicationStatus, ApplicationStep } from "@/lib/gateways";

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  preparing: "Preparing",
  "in-review": "In Review",
  sending: "Sending",
  sent: "Sent",
  cancelled: "Cancelled",
  "direct-apply": "Direct Apply",
  "no-contacts": "No Contacts",
  "all-in-cooldown": "All in Cooldown",
  failed: "Failed",
};

export const FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  "in-review": "In Review",
  working: "Working",
  sent: "Sent",
  failed: "Failed",
  other: "Other",
};

/** Blue working, amber needs the Admin, green Sent, red Failed, gray everything else. `chart` colors a status in Stats. */
const GROUP_TONES: Record<StatusGroup, { badge: string; chart: string }> = {
  working: { badge: "bg-blue-500/10 text-blue-700 ring-blue-500/25 dark:text-blue-300", chart: "#3b82f6" },
  "in-review": { badge: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300", chart: "#f59e0b" },
  sent: { badge: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300", chart: "#10b981" },
  failed: { badge: "bg-red-500/10 text-red-700 ring-red-500/25 dark:text-red-300", chart: "#ef4444" },
  other: { badge: "bg-subtle text-fg-2 ring-line-strong", chart: "#71717a" },
};

export const statusTone = (status: ApplicationStatus) => GROUP_TONES[statusGroup(status)];

export const STEP_NAMES: Record<ApplicationStep, string> = {
  "read-job": "Reading the Job page",
  "choose-resume": "Choosing a Resume",
  "find-company-page": "Finding the Company's LinkedIn page",
  "find-decision-makers": "Finding Decision Makers",
  "write-cover-letter": "Writing the Cover Letter",
  "check-sharing": "Checking the Resume Folder's sharing",
  send: "Sending",
};

/** A Job Board's name, or a Job Feed's domain. */
export const sourceName = (source: string) =>
  source.startsWith(FEED_SOURCE_PREFIX) ? source.slice(FEED_SOURCE_PREFIX.length) : source;

const BOARD_TONES: Record<string, string> = {
  Glassdoor: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
  LinkedIn: "bg-blue-500/10 text-blue-700 ring-blue-500/25 dark:text-blue-300",
};

/** One per Job Feed host, picked by hashing it. No green or blue: those are Glassdoor's and LinkedIn's. */
const FEED_TONES = [
  "bg-red-500/10 text-red-700 ring-red-500/25 dark:text-red-300",
  "bg-orange-500/10 text-orange-700 ring-orange-500/25 dark:text-orange-300",
  "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  "bg-yellow-500/10 text-yellow-700 ring-yellow-500/25 dark:text-yellow-300",
  "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300",
  "bg-purple-500/10 text-purple-700 ring-purple-500/25 dark:text-purple-300",
  "bg-fuchsia-500/10 text-fuchsia-700 ring-fuchsia-500/25 dark:text-fuchsia-300",
  "bg-pink-500/10 text-pink-700 ring-pink-500/25 dark:text-pink-300",
  "bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300",
  "bg-stone-500/10 text-stone-700 ring-stone-500/25 dark:text-stone-300",
];

/** A source's badge colors: green Glassdoor, blue LinkedIn, and a steady color per Job Feed host. */
export function sourceTone(source: string) {
  if (BOARD_TONES[source]) return BOARD_TONES[source];
  let hash = 0;
  for (const char of sourceName(source)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FEED_TONES[hash % FEED_TONES.length];
}
