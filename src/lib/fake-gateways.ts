import type {
  ActorRun,
  ActorRunStatus,
  ActorRunStore,
  FunctionRun,
  FunctionRunResult,
  FunctionRunStore,
  Job,
  JobBoardGateway,
  JobBoardSettings,
  JobBoardSettingsStore,
  JobStore,
  TelegramGateway,
} from "./gateways";
import { COLLECT_JOBS, type JobSearch } from "./schema";

export class FakeFunctionRunStore implements FunctionRunStore {
  private runs: FunctionRun[] = [];

  async start(functionName: string, startedAt: Date, timeLimitMs: number) {
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
    this.runs.push({ id, functionName, status: "running", startedAt, finishedAt: null, error: null });
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
  sent: string[] = [];
  failing = false;

  async send(text: string) {
    if (this.failing) throw new Error("Telegram is down");
    this.sent.push(text);
  }
}

export class FakeJobStore implements JobStore {
  private jobs: Job[] = [];

  async save(jobs: Job[]) {
    const before = this.jobs.length;
    for (const job of jobs) {
      if (!this.jobs.some(({ url }) => url === job.url)) this.jobs.push(job);
    }
    return this.jobs.length - before;
  }

  async list() {
    return this.jobs;
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

/** Each run reports the statuses queued here in turn, stays on the last, and returns the Jobs given. */
export class FakeJobBoard implements JobBoardGateway {
  source = "LinkedIn";
  actor = "valig/linkedin-jobs-scraper";
  started: { runId: string; search: JobSearch; limit: number; token: string }[] = [];
  statuses: ActorRunStatus[] = ["succeeded"];
  private polls = new Map<string, number>();

  constructor(public jobs: Job[]) {}

  async start(search: JobSearch, limit: number, token: string) {
    const runId = `run-${this.started.length + 1}`;
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
