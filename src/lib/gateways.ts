import type { z } from "zod";
import type {
  actorRuns,
  applications,
  decisionMakers,
  functionRuns,
  JobFunction,
  jobBoardSettings,
  jobFeeds,
  jobs,
  JobSearch,
  LlmProvider,
} from "./schema";

export type FunctionRun = typeof functionRuns.$inferSelect;

export type FunctionRunResult = Pick<FunctionRun, "finishedAt" | "error"> & {
  status: "succeeded" | "failed";
};

export interface FunctionRunStore {
  /**
   * Marks runs past the time limit as failed, then claims a new run, for the Application when one is given.
   * Null means one is already active.
   */
  start(functionName: string, startedAt: Date, timeLimitMs: number, applicationId?: number): Promise<number | null>;
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

export type DriveFile = { id: string; name: string; mimeType: string; webViewLink: string };

/** The Admin's Google connection: the long-lived refresh token and the latest access token. */
export type GoogleTokens = { refreshToken: string; accessToken: string; expiresAt: Date };

export interface GoogleConnectionStore {
  get(): Promise<GoogleTokens | undefined>;
  save(tokens: GoogleTokens): Promise<void>;
}

export type DriveFolder = { id: string; name: string };

export interface ResumeFolderStore {
  get(): Promise<DriveFolder | undefined>;
  save(folder: DriveFolder): Promise<void>;
}

export type GrantedTokens = { accessToken: string; expiresInSeconds: number; refreshToken?: string };

export interface DriveGateway {
  /** Every folder the Admin owns, by name. */
  listFolders(): Promise<DriveFolder[]>;
  /** The files directly inside a folder. */
  listFiles(folderId: string): Promise<DriveFile[]>;
  /** Whether the folder is shared as "Anyone with the link", so its Resume links open for recipients. */
  isSharedByLink(folderId: string): Promise<boolean>;
}

export interface GoogleOAuthGateway {
  /** Trades the OAuth callback's code for tokens. Throws unless every scope was granted along with a refresh token. */
  exchange(code: string, redirectUri: string): Promise<GrantedTokens & { refreshToken: string }>;
  /** Null when Google no longer accepts the refresh token, because it was revoked or expired. */
  refresh(refreshToken: string): Promise<GrantedTokens | null>;
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
export type SavedJob = Job & { id: number };
export type PendingAlertJob = SavedJob;
/** A Job as a source returns it. Job Collection works out its post day. */
export type CollectedJob = Omit<Job, "postDay"> & { postDay?: string | null; ageInDays?: number | null };
export type JobBoardSettings = typeof jobBoardSettings.$inferSelect;
export type ActorRun = Pick<typeof actorRuns.$inferSelect, "runId" | "actor" | "token" | "search" | "startedAt">;
/** An actor run of an Application's Decision Maker search, found again by its purpose on a Retry. */
export type ApplicationActorRun = ActorRun & { applicationId: number; purpose: string };
export type ActorRunStatus = "running" | "succeeded" | "failed";

export interface JobStore {
  /** Ignores any Job whose URL is already saved, and returns how many were new. */
  save(jobs: Job[]): Promise<number>;
  list(): Promise<Job[]>;
  get(id: number): Promise<SavedJob | undefined>;
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
  save(run: ActorRun | ApplicationActorRun): Promise<void>;
  /** Every Job Collection actor run that hasn't been closed yet, oldest first. */
  listUnfinished(): Promise<ActorRun[]>;
  /**
   * The Application's actor runs that haven't been closed, oldest first.
   * A finished run stays open so a Retry rereads its results; a failed one is closed so a Retry starts it again.
   */
  listForApplication(applicationId: number): Promise<ApplicationActorRun[]>;
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

export type Application = typeof applications.$inferSelect;
export type ApplicationStatus = Application["status"];
export type PrepareStep = Application["currentStep"];
export type ApplicationChanges = Partial<Omit<Application, "id" | "jobId" | "createdAt">>;

export interface ApplicationStore {
  /** Atomically creates the Job's one Application, as preparing. Null when the Job already has one. */
  claim(jobId: number, createdAt: Date): Promise<number | null>;
  get(id: number): Promise<Application | undefined>;
  /** Atomically sets a failed Application back to preparing, clearing its error. False when it isn't failed. */
  retry(id: number): Promise<boolean>;
  update(id: number, changes: ApplicationChanges): Promise<void>;
}

export interface JobPageReader {
  /** The Job page's main content as markdown. Throws when the page can't be read. */
  read(url: string): Promise<string>;
}

export type Company = { name: string; linkedinUrl: string };
export type SavedCompany = Company & { id: number };

export interface CompanyStore {
  /** The Company with this LinkedIn page, created when there's none yet. Returns its ID. */
  findOrCreate(company: Company): Promise<number>;
  get(id: number): Promise<SavedCompany | undefined>;
  /** The Company with this LinkedIn page, if it's saved. */
  findByLinkedinUrl(linkedinUrl: string): Promise<SavedCompany | undefined>;
}

export type SearchResult = { url: string; title: string };

/** A person the employees actor found at a Company. */
export type Person = { name: string; headline: string; profileUrl: string };
export type EmployeeSearch = { companyUrl: string; jobFunction: JobFunction; maxEmployees: number };
/** The email actor's answer for one profile. Its URL may be normalized differently from the one looked up. */
export type FoundEmail = { profileUrl: string; email: string | null };

/** One Apify actor: started without waiting, polled for its status, then read. */
export interface ActorGateway<Input, Result> {
  actor: string;
  start(input: Input, token: string): Promise<string>;
  status(run: ActorRun): Promise<ActorRunStatus>;
  results(run: ActorRun): Promise<Result[]>;
}

export type EmployeesActor = ActorGateway<EmployeeSearch, Person>;
export type EmailsActor = ActorGateway<string[], FoundEmail>;

export type DecisionMaker = typeof decisionMakers.$inferSelect;
export type FoundPerson = Pick<DecisionMaker, "name" | "headline" | "profileUrl" | "email" | "jobFunction">;

export interface DecisionMakerStore {
  /**
   * Saves the people found at the Company, replacing any saved by the same name but keeping a known email when
   * none was found this time, and dates its People Refresh.
   */
  save(companyId: number, people: FoundPerson[], foundAt: Date): Promise<DecisionMaker[]>;
  /** Everyone ever found at the Company, in the order they were first found. */
  listForCompany(companyId: number): Promise<DecisionMaker[]>;
  /** When the Company's Decision Makers were last searched for. Null when they never were. */
  peopleFoundAt(companyId: number): Promise<Date | null>;
  /** Makes them the Application's Decision Makers. */
  addToApplication(applicationId: number, decisionMakerIds: number[]): Promise<void>;
  listForApplication(applicationId: number): Promise<DecisionMaker[]>;
}

export interface CompanyPageSearch {
  /** The web search's first result only. Null when there's none. Throws when the search fails. */
  firstResult(query: string): Promise<SearchResult | null>;
}

export type LlmChoice = { provider: LlmProvider; model: string };

export interface LlmSettingsStore {
  get(): Promise<LlmChoice | undefined>;
  save(choice: LlmChoice): Promise<void>;
}

export interface ScheduleSettingsStore {
  /** Whether the daily Modal schedule runs Job Collection. False until it's turned on. */
  collectionEnabled(): Promise<boolean>;
  saveCollectionEnabled(enabled: boolean): Promise<void>;
}

export type LlmRequest<T> = { instructions: string; prompt: string; schema: z.ZodType<T> };

export interface LlmGateway {
  /** One request, answered with the provider's structured output and parsed with the schema. */
  generate<T>(request: LlmRequest<T>): Promise<T>;
}
