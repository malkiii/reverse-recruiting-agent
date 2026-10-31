import type { Job, JobBoardGateway, JobStore } from "./gateways";

export class FakeJobBoard implements JobBoardGateway {
  constructor(private jobs: Job[]) {}

  async collect() {
    return this.jobs;
  }
}

export class FakeJobStore implements JobStore {
  private jobs: Job[] = [];

  async save(jobs: Job[]) {
    this.jobs.push(...jobs);
  }

  async list() {
    return this.jobs;
  }
}
