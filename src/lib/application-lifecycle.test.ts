import { expect, test } from "vitest";
import { prepare, runPreparation } from "./application-lifecycle";
import {
  FakeApplicationStore,
  FakeDrive,
  FakeJobPages,
  FakeJobStore,
  FakeLlm,
  FakeResumeFolderStore,
} from "./fake-gateways";

const now = new Date("2026-11-04T10:00:00Z");

const linkedInJob = {
  source: "LinkedIn",
  title: "Backend Engineer",
  companyName: "Acme",
  location: "Remote",
  url: "https://www.linkedin.com/jobs/view/1",
  postDay: "2026-11-04",
  description: "Collected description: build APIs in Go",
  companyLinkedinUrl: null,
  companyLogoUrl: null,
};

const feedJob = {
  ...linkedInJob,
  source: "Feed: weworkremotely.com",
  title: "Data Analyst",
  url: "https://weworkremotely.com/jobs/2",
  description: null,
};

const pdf = (name: string) => ({
  id: `file-${name}`,
  name,
  mimeType: "application/pdf",
  webViewLink: `https://drive.google.com/file/${name}`,
});

async function setup() {
  const jobs = new FakeJobStore();
  await jobs.save([linkedInJob, feedJob]);
  const drive = new FakeDrive();
  drive.files.set("folder", [pdf("Backend Engineer Resume.pdf"), pdf("Data Analyst CV.pdf"), pdf("Notes.pdf")]);
  const llm = new FakeLlm();
  return {
    jobs,
    applications: new FakeApplicationStore(),
    jobPages: new FakeJobPages(),
    resumeFolder: new FakeResumeFolderStore({ id: "folder", name: "Resumes" }),
    drive: async () => drive,
    llm: async () => llm,
    now: () => now,
    // Handles for the tests.
    fakeDrive: drive,
    fakeLlm: llm,
  };
}

test("a double click on Prepare claims only one Application for the Job", async () => {
  const deps = await setup();

  const claims = await Promise.all([prepare(deps, 1), prepare(deps, 1)]);

  expect(claims.filter((id) => id !== null)).toHaveLength(1);
  expect(await deps.applications.list()).toMatchObject([{ jobId: 1, status: "preparing", createdAt: now }]);
});

const answer = {
  industryKeywords: ["software", "fintech"],
  jobLocation: "Berlin, Germany",
  resumeFilename: "Backend Engineer Resume.pdf",
  jobSummary: "Acme needs a backend engineer to build payment APIs in Go.",
};

test("Prepare reads the Job page and saves the Resume and Job Summary the LLM chose", async () => {
  const deps = await setup();
  deps.jobPages.pages.set(linkedInJob.url, "# Backend Engineer\nBuild payment APIs in Go.");
  deps.fakeLlm.answers.push(answer);
  const id = (await prepare(deps, 1))!;

  await runPreparation(deps, id);

  expect(await deps.applications.get(id)).toMatchObject({
    status: "preparing",
    currentStep: "find-company-page",
    error: null,
    jobPage: "# Backend Engineer\nBuild payment APIs in Go.",
    industryKeywords: ["software", "fintech"],
    jobLocation: "Berlin, Germany",
    jobSummary: "Acme needs a backend engineer to build payment APIs in Go.",
    resumeFileId: "file-Backend Engineer Resume.pdf",
    resumeName: "Backend Engineer Resume.pdf",
    resumeLink: "https://drive.google.com/file/Backend Engineer Resume.pdf",
  });
});

test("the LLM gets the Job page and only the Resume filenames, each wrapped in XML tags", async () => {
  const deps = await setup();
  deps.jobPages.pages.set(linkedInJob.url, "Build payment APIs in Go.");
  deps.fakeLlm.answers.push(answer);

  await runPreparation(deps, (await prepare(deps, 1))!);

  const [{ prompt }] = deps.fakeLlm.requests;
  expect(prompt).toContain("<job_page>\nBuild payment APIs in Go.\n</job_page>");
  expect(prompt).toContain("<resume_filename>Backend Engineer Resume.pdf</resume_filename>");
  expect(prompt).toContain("<resume_filename>Data Analyst CV.pdf</resume_filename>");
  expect(prompt).not.toContain("Notes.pdf");
});

test("a Job Board Job whose page can't be read falls back to its collected description", async () => {
  const deps = await setup();
  deps.fakeLlm.answers.push(answer);
  const id = (await prepare(deps, 1))!;

  await runPreparation(deps, id);

  expect(await deps.applications.get(id)).toMatchObject({
    status: "preparing",
    currentStep: "find-company-page",
    jobPage: "Collected description: build APIs in Go",
  });
  expect(deps.fakeLlm.requests[0].prompt).toContain("Collected description: build APIs in Go");
});

test("a Feed Job whose page can't be read ends as Direct Apply without asking the LLM", async () => {
  const deps = await setup();
  const id = (await prepare(deps, 2))!;

  await runPreparation(deps, id);

  expect(await deps.applications.get(id)).toMatchObject({ status: "direct-apply", jobPage: null });
  expect(deps.fakeLlm.requests).toEqual([]);
});

test("the Application stops when the LLM returns a filename that isn't a listed Resume", async () => {
  const deps = await setup();
  deps.jobPages.pages.set(linkedInJob.url, "Build payment APIs in Go.");
  deps.fakeLlm.answers.push({ ...answer, resumeFilename: "Notes.pdf" });
  const id = (await prepare(deps, 1))!;

  await runPreparation(deps, id);

  expect(await deps.applications.get(id)).toMatchObject({
    status: "failed",
    currentStep: "choose-resume",
    error: 'The LLM chose "Notes.pdf", which isn\'t one of your Resumes',
    resumeFileId: null,
  });
});

test("the Application stops before reading the Job page when the Resume Folder has no Resume", async () => {
  const deps = await setup();
  deps.fakeDrive.files.set("folder", [pdf("Notes.pdf")]);
  deps.jobPages.pages.set(linkedInJob.url, "Build payment APIs in Go.");
  const id = (await prepare(deps, 1))!;

  await runPreparation(deps, id);

  expect(await deps.applications.get(id)).toMatchObject({
    status: "failed",
    error: "Your Resume Folder has no Resume: add a PDF whose name ends in \"resume\" or \"CV\"",
  });
  expect(deps.jobPages.urlsRead).toEqual([]);
  expect(deps.fakeLlm.requests).toEqual([]);
});

test("the Application stops when no Resume Folder is chosen", async () => {
  const deps = await setup();
  deps.resumeFolder.folder = undefined;
  const id = (await prepare(deps, 1))!;

  await runPreparation(deps, id);

  expect(await deps.applications.get(id)).toMatchObject({
    status: "failed",
    error: "No Resume Folder is chosen: choose one on the dashboard's Google page",
  });
});

test("an LLM error marks the Application failed, keeps the Job page read, and fails the Function", async () => {
  const deps = await setup();
  deps.jobPages.pages.set(linkedInJob.url, "Build payment APIs in Go.");
  const id = (await prepare(deps, 1))!;

  await expect(runPreparation(deps, id)).rejects.toThrow("The LLM has no answer queued");

  expect(await deps.applications.get(id)).toMatchObject({
    status: "failed",
    currentStep: "choose-resume",
    jobPage: "Build payment APIs in Go.",
    error: "The LLM has no answer queued",
  });
});
