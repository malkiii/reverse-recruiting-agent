import type {
  ActorRun,
  Application,
  ApplicationChanges,
  ApplicationStore,
  DriveFile,
  DriveFolder,
  DriveGateway,
  JobPageReader,
  LlmChoice,
  LlmGateway,
  LlmRequest,
  LlmSettingsStore,
  ResumeFolderStore,
  ActorRunStatus,
  ActorRunStore,
  AlertState,
  CollectedJob,
  ExcludedKeywordStore,
  FunctionRun,
  FunctionRunResult,
  FunctionRunStore,
  GoogleConnectionStore,
  GoogleOAuthGateway,
  GoogleTokens,
  GrantedTokens,
  Image,
  ImageGateway,
  Job,
  JobBoardGateway,
  JobBoardSettings,
  JobBoardSettingsStore,
  JobFeed,
  JobFeedReader,
  JobFeedStore,
  JobStore,
  PlaceholderName,
  SkippedApifyTokenStore,
  TelegramGateway,
  TelegramLink,
} from "./gateways";
import { COLLECT_JOBS, type JobSearch } from "./schema";

export class FakeFunctionRunStore implements FunctionRunStore {
  private runs: FunctionRun[] = [];

  async start(functionName: string, startedAt: Date, timeLimitMs: number, applicationId?: number) {
    this.runs = this.runs.map((run) =>
      run.functionName === functionName &&
      run.status === "running" &&
      run.startedAt.getTime() <= startedAt.getTime() - timeLimitMs
        ? { ...run, status: "failed", finishedAt: startedAt, error: "Passed its time limit" }
        : run,
    );
    const active = this.runs.some((run) => run.functionName === COLLECT_JOBS && run.status === "running");
    if (functionName === COLLECT_JOBS && active) return null;

    const id = this.runs.length + 1;
    this.runs.push({
      id,
      functionName,
      status: "running",
      startedAt,
      finishedAt: null,
      error: null,
      applicationId: applicationId ?? null,
    });
    return id;
  }

  async finish(id: number, result: FunctionRunResult) {
    this.runs = this.runs.map((run) => (run.id === id ? { ...run, ...result } : run));
  }

  async list() {
    return this.runs;
  }
}

export class FakeTelegram implements TelegramGateway {
  messages: { text: string; link?: TelegramLink; html?: true; photo?: Image }[] = [];
  failing = false;

  get sent() {
    return this.messages.map(({ text }) => text);
  }

  async send(text: string, link?: TelegramLink) {
    if (this.failing) throw new Error("Telegram is down");
    this.messages.push(link ? { text, link } : { text });
  }

  async sendHtml(html: string, link: TelegramLink, photo?: Image) {
    if (this.failing) throw new Error("Telegram is down");
    this.messages.push(photo ? { text: html, link, html: true, photo } : { text: html, link, html: true });
  }
}

/** Serves the images, OG image URLs and placeholders set here. Anything else is null. */
export class FakeImages implements ImageGateway {
  images = new Map<string, Image>();
  pageImages = new Map<string, string>();
  placeholders = new Map<PlaceholderName, Image>();

  async download(url: string) {
    return this.images.get(url) ?? null;
  }

  async pageImageUrl(pageUrl: string) {
    return this.pageImages.get(pageUrl) ?? null;
  }

  async placeholder(name: PlaceholderName) {
    return this.placeholders.get(name) ?? null;
  }
}

export class FakeJobStore implements JobStore {
  private jobs: (Job & { id: number; alertState: AlertState })[] = [];

  async save(jobs: Job[]) {
    const before = this.jobs.length;
    for (const job of jobs) {
      const duplicate = this.jobs.some(
        (saved) =>
          saved.url === job.url ||
          (saved.title.toLowerCase() === job.title.toLowerCase() &&
            saved.companyName.toLowerCase() === job.companyName.toLowerCase() &&
            saved.postDay === job.postDay),
      );
      if (!duplicate) this.jobs.push({ ...job, id: this.jobs.length + 1, alertState: "pending" });
    }
    return this.jobs.length - before;
  }

  async list(): Promise<Job[]> {
    return this.jobs.map(({ id: _id, alertState: _alertState, ...job }) => job);
  }

  async get(id: number) {
    const saved = this.jobs.find((job) => job.id === id);
    if (!saved) return undefined;
    const { alertState: _, ...job } = saved;
    return job;
  }

  async listPendingAlerts() {
    return this.jobs.filter(({ alertState }) => alertState === "pending").map(({ alertState: _, ...job }) => job);
  }

  async markAlertSent(id: number) {
    this.jobs = this.jobs.map((job) => (job.id === id ? { ...job, alertState: "sent" } : job));
  }
}

export class FakeJobBoardSettingsStore implements JobBoardSettingsStore {
  constructor(private settings: JobBoardSettings[]) {}

  async get(source: string) {
    return this.settings.find((settings) => settings.source === source);
  }

  async save(settings: JobBoardSettings) {
    this.settings = [...this.settings.filter(({ source }) => source !== settings.source), settings];
  }
}

export class FakeExcludedKeywordStore implements ExcludedKeywordStore {
  constructor(private keywords: string[] = []) {}

  async list() {
    return this.keywords;
  }

  async replace(keywords: string[]) {
    this.keywords = [...new Set(keywords)];
  }
}

export class FakeActorRunStore implements ActorRunStore {
  private runs: (ActorRun & { closed: boolean })[] = [];

  async save(run: ActorRun) {
    this.runs.push({ ...run, closed: false });
  }

  async listUnfinished() {
    return this.runs.filter(({ closed }) => !closed);
  }

  async close(runId: string) {
    this.runs = this.runs.map((run) => (run.runId === runId ? { ...run, closed: true } : run));
  }

  async lastToken() {
    return this.runs.at(-1)?.token;
  }
}

export class FakeSkippedApifyTokenStore implements SkippedApifyTokenStore {
  usableAt = new Map<string, Date>();

  async listSkipped(at: Date) {
    return [...this.usableAt].filter(([, usableAt]) => usableAt > at).map(([token]) => token);
  }

  async skip(token: string, usableAt: Date) {
    this.usableAt.set(token, usableAt);
  }
}

export class FakeJobFeedStore implements JobFeedStore {
  private feeds: JobFeed[] = [];

  async list() {
    return this.feeds;
  }

  async add(url: string) {
    const feed = { id: this.feeds.length + 1, url, enabled: true };
    this.feeds.push(feed);
    return feed;
  }

  async update(feed: JobFeed) {
    this.feeds = this.feeds.map((saved) => (saved.id === feed.id ? feed : saved));
  }

  async remove(id: number) {
    this.feeds = this.feeds.filter((feed) => feed.id !== id);
  }
}

/** Returns the Jobs set for each Job Feed URL, or throws the error set for it. */
export class FakeJobFeedReader implements JobFeedReader {
  jobs = new Map<string, CollectedJob[] | Error>();
  urlsRead: string[] = [];

  async read(url: string) {
    this.urlsRead.push(url);
    const result = this.jobs.get(url) ?? [];
    if (result instanceof Error) throw result;
    return result;
  }
}

/** Each run reports the statuses queued here in turn, stays on the last, and returns the Jobs given. */
export class FakeJobBoard implements JobBoardGateway {
  started: { runId: string; search: JobSearch; limit: number; token: string }[] = [];
  statuses: ActorRunStatus[] = ["succeeded"];
  private polls = new Map<string, number>();

  constructor(
    public jobs: CollectedJob[],
    public source = "LinkedIn",
    public actor = "worldunboxer/rapid-linkedin-scraper",
  ) {}

  async start(search: JobSearch, limit: number, token: string) {
    const runId = `${this.source}-run-${this.started.length + 1}`;
    this.started.push({ runId, search, limit, token });
    return runId;
  }

  async status({ runId }: ActorRun) {
    const polls = this.polls.get(runId) ?? 0;
    this.polls.set(runId, polls + 1);
    return this.statuses[Math.min(polls, this.statuses.length - 1)];
  }

  async results(_run: ActorRun) {
    return this.jobs;
  }
}

export class FakeGoogleConnectionStore implements GoogleConnectionStore {
  constructor(public tokens?: GoogleTokens) {}

  async get() {
    return this.tokens;
  }

  async save(tokens: GoogleTokens) {
    this.tokens = tokens;
  }
}

/** Grants the tokens set here for any code, and for any refresh token in `accepted`, and null for the rest. */
export class FakeGoogleOAuth implements GoogleOAuthGateway {
  exchanged: { code: string; redirectUri: string }[] = [];
  refreshed: string[] = [];
  accepted = new Set(["refresh"]);
  grant: GrantedTokens = { accessToken: "renewed", expiresInSeconds: 3600 };

  async exchange(code: string, redirectUri: string) {
    this.exchanged.push({ code, redirectUri });
    return { refreshToken: "refresh", ...this.grant };
  }

  async refresh(refreshToken: string) {
    this.refreshed.push(refreshToken);
    return this.accepted.has(refreshToken) ? this.grant : null;
  }
}

export class FakeApplicationStore implements ApplicationStore {
  private applications: Application[] = [];

  async claim(jobId: number, createdAt: Date) {
    if (this.applications.some((application) => application.jobId === jobId)) return null;
    const id = this.applications.length + 1;
    this.applications.push({
      id,
      jobId,
      status: "preparing",
      currentStep: "read-job",
      error: null,
      jobPage: null,
      industryKeywords: null,
      jobLocation: null,
      jobSummary: null,
      resumeFileId: null,
      resumeName: null,
      resumeLink: null,
      createdAt,
    });
    return id;
  }

  async get(id: number) {
    return this.applications.find((application) => application.id === id);
  }

  async list() {
    return this.applications;
  }

  async update(id: number, changes: ApplicationChanges) {
    this.applications = this.applications.map((application) =>
      application.id === id ? { ...application, ...changes } : application,
    );
  }
}

/** Returns the markdown set for each URL, and throws for any other. */
export class FakeJobPages implements JobPageReader {
  pages = new Map<string, string>();
  urlsRead: string[] = [];

  async read(url: string) {
    this.urlsRead.push(url);
    const page = this.pages.get(url);
    if (page === undefined) throw new Error(`Firecrawl couldn't read ${url}`);
    return page;
  }
}

export class FakeResumeFolderStore implements ResumeFolderStore {
  constructor(public folder?: DriveFolder) {}

  async get() {
    return this.folder;
  }

  async save(folder: DriveFolder) {
    this.folder = folder;
  }
}

/** One Drive: the folders, the files in each and the folders shared by link, as set here. */
export class FakeDrive implements DriveGateway {
  folders: DriveFolder[] = [];
  files = new Map<string, DriveFile[]>();
  sharedByLink = new Set<string>();

  async listFolders() {
    return this.folders;
  }

  async listFiles(folderId: string) {
    return this.files.get(folderId) ?? [];
  }

  async isSharedByLink(folderId: string) {
    return this.sharedByLink.has(folderId);
  }
}

export class FakeLlmSettingsStore implements LlmSettingsStore {
  constructor(public choice?: LlmChoice) {}

  async get() {
    return this.choice;
  }

  async save(choice: LlmChoice) {
    this.choice = choice;
  }
}

/** Answers each request with the next answer queued here, parsed with the request's schema. */
export class FakeLlm implements LlmGateway {
  requests: LlmRequest<unknown>[] = [];
  answers: unknown[] = [];

  async generate<T>(request: LlmRequest<T>) {
    this.requests.push(request);
    if (this.answers.length === 0) throw new Error("The LLM has no answer queued");
    return request.schema.parse(this.answers.shift());
  }
}
