export type Job = {
  source: string;
  title: string;
  companyName: string;
  location: string;
  url: string;
  postDay: string;
  description: string | null;
};

export interface JobBoardGateway {
  collect(): Promise<Job[]>;
}

export interface JobStore {
  save(jobs: Job[]): Promise<void>;
  list(): Promise<Job[]>;
}
