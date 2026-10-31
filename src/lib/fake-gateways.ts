import type {
  ActorRun,
  ActorRunStore,
  Job,
  JobBoardGateway,
  JobBoardSettings,
  JobBoardSettingsStore,
  JobStore,
} from "./gateways";

export class FakeJobBoard implements JobBoardGateway {
  source = "LinkedIn";
  started: { runId: string; token: string }[] = [];

  constructor(private jobs: Job[]) {}

  async start(_settings: JobBoardSettings, token: string) {
    const runId = `run-${this.started.length + 1}`;
    this.started.push({ runId, token });
    return runId;
  }

  async results() {
    return this.jobs;
  }
}

export class FakeJobStore implements JobStore {
  private jobs: Job[] = [];

  async save(jobs: Job[]) {
    for (const job of jobs) {
      if (!this.jobs.some(({ url }) => url === job.url)) this.jobs.push(job);
    }
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
  private runs: ActorRun[] = [];

  async save(run: ActorRun) {
    this.runs.push(run);
  }

  async get(runId: string) {
    return this.runs.find((run) => run.runId === runId);
  }

  async lastToken() {
    return this.runs.at(-1)?.token;
  }
}
