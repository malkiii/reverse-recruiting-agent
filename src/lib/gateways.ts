import type { actorRuns, functionRuns, jobBoardSettings, jobFeeds, jobs, JobSearch } from "./schema";

export type FunctionRun = typeof functionRuns.$inferSelect;

export type FunctionRunResult = Pick<FunctionRun, "finishedAt" | "error"> & {
  status: "succeeded" | "failed";
};

export interface FunctionRunStore {
  /** Marks runs past the time limit as failed, then claims a new run. Null means one is already active. */
  start(functionName: string, startedAt: Date, timeLimitMs: number): Promise<number | null>;
  finish(id: number, result: FunctionRunResult): Promise<void>;
  list(): Promise<FunctionRun[]>;
}

export type TelegramLink = { label: string; url: string };

export type Image = { bytes: Uint8Array<ArrayBuffer>; type: string };

export interface TelegramGateway {
  /** Sends a plain text message, with one URL button when a link is given. */
  send(text: string, link?: TelegramLink): Promise<void>;
  /** Sends an HTML message with one URL button, as a photo's caption when a photo is given. */
  sendHtml(html: string, link: TelegramLink, photo?: Image): Promise<void>;
}

export type PlaceholderName = "linkedin" | "glassdoor";

/** Never throws: an image that can't be had is null. */
export interface ImageGateway {
  /** Null when the URL fails to fetch or isn't a photo Telegram takes. */
  download(url: string): Promise<Image | null>;
  /** The page's og:image URL. */
  pageImageUrl(pageUrl: string): Promise<string | null>;
  /** The placeholder image file for a source, null when it's missing. */
  placeholder(name: PlaceholderName): Promise<Image | null>;
}

export type Job = Omit<typeof jobs.$inferSelect, "id" | "alertState">;
export type AlertState = (typeof jobs.$inferSelect)["alertState"];
export type PendingAlertJob = Job & { id: number };
/** A Job as a source returns it. Job Collection works out its post day. */
export type CollectedJob = Omit<Job, "postDay"> & { postDay?: string | null; ageInDays?: number | null };
export type JobBoardSettings = typeof jobBoardSettings.$inferSelect;
export type ActorRun = Omit<typeof actorRuns.$inferSelect, "resultsSavedAt">;
export type ActorRunStatus = "running" | "succeeded" | "failed";

export interface JobStore {
  /** Ignores any Job whose URL is already saved, and returns how many were new. */
  save(jobs: Job[]): Promise<number>;
  list(): Promise<Job[]>;
  /** Jobs whose Job Alert hasn't gone out yet, oldest first. */
  listPendingAlerts(): Promise<PendingAlertJob[]>;
  markAlertSent(id: number): Promise<void>;
}

export interface JobBoardSettingsStore {
  get(source: string): Promise<JobBoardSettings | undefined>;
  save(settings: JobBoardSettings): Promise<void>;
}

export interface ExcludedKeywordStore {
  list(): Promise<string[]>;
  /** Replaces every Excluded Keyword with the given ones. */
  replace(keywords: string[]): Promise<void>;
}

export interface ActorRunStore {
  save(run: ActorRun): Promise<void>;
  /** Every actor run that hasn't been closed yet, oldest first. */
  listUnfinished(): Promise<ActorRun[]>;
  /** Closes the run, whether its results were saved or it failed and had none. */
  close(runId: string, closedAt: Date): Promise<void>;
  lastToken(): Promise<string | undefined>;
}

export interface SkippedApifyTokenStore {
  /** Tokens that can't be used again until after the given time. */
  listSkipped(at: Date): Promise<string[]>;
  skip(token: string, usableAt: Date): Promise<void>;
}

export type JobFeed = typeof jobFeeds.$inferSelect;

export interface JobFeedStore {
  list(): Promise<JobFeed[]>;
  add(url: string): Promise<JobFeed>;
  update(feed: JobFeed): Promise<void>;
  remove(id: number): Promise<void>;
}

export interface JobFeedReader {
  /** Reads the first page of a Job Feed only, in one Firecrawl request. */
  read(url: string): Promise<CollectedJob[]>;
}

export interface JobBoardGateway {
  source: string;
  actor: string;
  start(search: JobSearch, limit: number, token: string): Promise<string>;
  status(run: ActorRun): Promise<ActorRunStatus>;
  results(run: ActorRun): Promise<CollectedJob[]>;
}
