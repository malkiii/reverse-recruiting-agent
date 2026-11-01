import type { FunctionRun, FunctionRunResult, FunctionRunStore } from "./gateways";

export class FakeFunctionRunStore implements FunctionRunStore {
  private runs: FunctionRun[] = [];

  async start(functionName: string, startedAt: Date) {
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
