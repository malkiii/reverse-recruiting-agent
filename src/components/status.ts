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
