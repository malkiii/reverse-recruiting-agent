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

/** Blue working, amber needs the Admin, green Sent, red Failed, gray everything else. */
const GROUP_TONES: Record<StatusGroup, { badge: string; bar: string }> = {
  working: {
    badge: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/30",
    bar: "bg-blue-500",
  },
  "in-review": {
    badge: "bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/30",
    bar: "bg-amber-500",
  },
  sent: {
    badge:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30",
    bar: "bg-emerald-500",
  },
  failed: {
    badge: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/30",
    bar: "bg-red-500",
  },
  other: {
    badge: "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/30",
    bar: "bg-slate-400",
  },
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
