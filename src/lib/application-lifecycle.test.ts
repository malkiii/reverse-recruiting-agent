import { expect, test } from "vitest";
import { prepare, retry, runPreparation } from "./application-lifecycle";
import {
  FakeApplicationStore,
  FakeCompanyPageSearch,
  FakeCompanyStore,
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

const acmeQuery = "Acme software fintech in Berlin, Germany site:linkedin.com/company";
const acmePage = { url: "https://www.linkedin.com/company/acme-corp", title: "ACME, Inc. | LinkedIn" };

async function setup() {
  const jobs = new FakeJobStore();
  await jobs.save([linkedInJob, feedJob]);
  const drive = new FakeDrive();
  drive.files.set("folder", [pdf("Backend Engineer Resume.pdf"), pdf("Data Analyst CV.pdf"), pdf("Notes.pdf")]);
  const llm = new FakeLlm();
  const companyPageSearch = new FakeCompanyPageSearch();
  companyPageSearch.results.set(acmeQuery, acmePage);
  return {
    jobs,
    applications: new FakeApplicationStore(),
    jobPages: new FakeJobPages(),
    companies: new FakeCompanyStore(),
    companyPageSearch,
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

test("Prepare uses a Job Board Job's collected description and saves the Resume and Job Summary the LLM chose", async () => {
  const deps = await setup();
  deps.fakeLlm.answers.push(answer);
  const id = (await prepare(deps, 1))!;

  await runPreparation(deps, id);

  expect(await deps.applications.get(id)).toMatchObject({
    status: "preparing",
    currentStep: "find-decision-makers",
    error: null,
    jobPage: "Collected description: build APIs in Go",
    industryKeywords: ["software", "fintech"],
    jobLocation: "Berlin, Germany",
    jobSummary: "Acme needs a backend engineer to build payment APIs in Go.",
    resumeFileId: "file-Backend Engineer Resume.pdf",
    resumeName: "Backend Engineer Resume.pdf",
    resumeLink: "https://drive.google.com/file/Backend Engineer Resume.pdf",
  });
  expect(deps.jobPages.urlsRead).toEqual([]);
});

test("the LLM gets the Job page and only the Resume filenames, each wrapped in XML tags", async () => {
  const deps = await setup();
  deps.jobPages.pages.set(feedJob.url, "Build payment APIs in Go.");
  deps.fakeLlm.answers.push(answer);

  await runPreparation(deps, (await prepare(deps, 2))!);

  const [{ prompt }] = deps.fakeLlm.requests;
  expect(prompt).toContain("<job_page>\nBuild payment APIs in Go.\n</job_page>");
  expect(prompt).toContain("<resume_filename>Backend Engineer Resume.pdf</resume_filename>");
  expect(prompt).toContain("<resume_filename>Data Analyst CV.pdf</resume_filename>");
  expect(prompt).not.toContain("Notes.pdf");
});

test("Prepare reads a Feed Job's page and saves it as the Job page", async () => {
  const deps = await setup();
  deps.jobPages.pages.set(feedJob.url, "# Data Analyst\nBuild dashboards.");
  deps.fakeLlm.answers.push({ ...answer, resumeFilename: "Data Analyst CV.pdf" });
  const id = (await prepare(deps, 2))!;

  await runPreparation(deps, id);

  expect(await deps.applications.get(id)).toMatchObject({
    status: "preparing",
    currentStep: "find-decision-makers",
    jobPage: "# Data Analyst\nBuild dashboards.",
    resumeName: "Data Analyst CV.pdf",
  });
  expect(deps.jobPages.urlsRead).toEqual([feedJob.url]);
});

test("a Job Board Job with no description ends as Direct Apply without reading its page or asking the LLM", async () => {
  const deps = await setup();
  await deps.jobs.save([{ ...linkedInJob, title: "Frontend Engineer", url: "https://www.linkedin.com/jobs/view/3", description: "  " }]);
  const id = (await prepare(deps, 3))!;

  await runPreparation(deps, id);

  expect(await deps.applications.get(id)).toMatchObject({
    status: "direct-apply",
    error: "The Job has no description, so apply through the Job link",
    jobPage: null,
  });
  expect(deps.jobPages.urlsRead).toEqual([]);
  expect(deps.fakeLlm.requests).toEqual([]);
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
  deps.jobPages.pages.set(feedJob.url, "Build dashboards.");
  const id = (await prepare(deps, 2))!;

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

test("an LLM error marks the Application failed, keeps the Job page, and fails the Function", async () => {
  const deps = await setup();
  const id = (await prepare(deps, 1))!;

  await expect(runPreparation(deps, id)).rejects.toThrow("The LLM has no answer queued");

  expect(await deps.applications.get(id)).toMatchObject({
    status: "failed",
    currentStep: "choose-resume",
    jobPage: "Collected description: build APIs in Go",
    error: "The LLM has no answer queued",
  });
});

test("a Job with a saved Company LinkedIn page uses it without searching", async () => {
  const deps = await setup();
  await deps.jobs.save([
    { ...linkedInJob, title: "Platform Engineer", url: "https://www.linkedin.com/jobs/view/3", companyLinkedinUrl: "https://www.linkedin.com/company/acme" },
  ]);
  deps.fakeLlm.answers.push(answer);
  const id = (await prepare(deps, 3))!;

  await runPreparation(deps, id);

  expect(deps.companyPageSearch.queries).toEqual([]);
  expect(deps.companies.companies).toEqual([{ id: 1, name: "Acme", linkedinUrl: "https://www.linkedin.com/company/acme" }]);
  expect(await deps.applications.get(id)).toMatchObject({
    status: "preparing",
    currentStep: "find-decision-makers",
    companyId: 1,
  });
});

test("Prepare searches for the Company's LinkedIn page and accepts a first result whose name matches", async () => {
  const deps = await setup();
  deps.fakeLlm.answers.push(answer);
  const id = (await prepare(deps, 1))!;

  await runPreparation(deps, id);

  expect(deps.companyPageSearch.queries).toEqual([acmeQuery]);
  expect(deps.companies.companies).toEqual([{ id: 1, name: "Acme", linkedinUrl: acmePage.url }]);
  expect(await deps.applications.get(id)).toMatchObject({ status: "preparing", companyId: 1 });
});

test("a first search result for another Company ends the Application as Direct Apply, keeping the chosen Resume", async () => {
  const deps = await setup();
  deps.companyPageSearch.results.set(acmeQuery, { url: "https://www.linkedin.com/company/globex", title: "Globex LLC | LinkedIn" });
  deps.fakeLlm.answers.push(answer);
  const id = (await prepare(deps, 1))!;

  await runPreparation(deps, id);

  expect(await deps.applications.get(id)).toMatchObject({
    status: "direct-apply",
    currentStep: "find-company-page",
    error: "The Company's LinkedIn page couldn't be confirmed, so apply through the Job link",
    resumeName: "Backend Engineer Resume.pdf",
    companyId: null,
  });
  expect(deps.companies.companies).toEqual([]);
});

test("no search result ends the Application as Direct Apply", async () => {
  const deps = await setup();
  deps.companyPageSearch.results.clear();
  deps.fakeLlm.answers.push(answer);
  const id = (await prepare(deps, 1))!;

  await runPreparation(deps, id);

  expect(await deps.applications.get(id)).toMatchObject({ status: "direct-apply", companyId: null });
});

test("a Retry from the Company page step searches again without reading the Job or asking the LLM", async () => {
  const deps = await setup();
  deps.companyPageSearch.results.clear();
  deps.fakeLlm.answers.push(answer);
  const id = (await prepare(deps, 1))!;
  await runPreparation(deps, id);
  await deps.applications.update(id, { status: "preparing", error: null });
  deps.companyPageSearch.results.set(acmeQuery, acmePage);

  await runPreparation(deps, id);

  expect(deps.fakeLlm.requests).toHaveLength(1);
  expect(await deps.applications.get(id)).toMatchObject({ currentStep: "find-decision-makers", companyId: 1 });
});

test("Retry resumes only a failed Application, once", async () => {
  const deps = await setup();
  const id = (await prepare(deps, 1))!;
  await deps.applications.update(id, { status: "failed", error: "Firecrawl was down" });

  const claims = await Promise.all([retry(deps, id), retry(deps, id)]);

  expect(claims).toEqual([id, null]);
  expect(await deps.applications.get(id)).toMatchObject({ status: "preparing", error: null });
});

test("company suffixes are removed only as whole words, so a name inside another Company's name doesn't match", async () => {
  const deps = await setup();
  await deps.jobs.save([{ ...linkedInJob, title: "ML Engineer", companyName: "Cohere", url: "https://www.linkedin.com/jobs/view/4" }]);
  deps.companyPageSearch.results.set("Cohere software fintech in Berlin, Germany site:linkedin.com/company", {
    url: "https://www.linkedin.com/company/here",
    title: "HERE Technologies | LinkedIn",
  });
  deps.fakeLlm.answers.push(answer);
  const id = (await prepare(deps, 3))!;

  await runPreparation(deps, id);

  expect(await deps.applications.get(id)).toMatchObject({ status: "direct-apply", companyId: null });
});

test("the match ignores company suffixes such as Inc and Ltd", async () => {
  const deps = await setup();
  await deps.jobs.save([{ ...linkedInJob, title: "SRE", companyName: "Initech Inc", url: "https://www.linkedin.com/jobs/view/4" }]);
  deps.companyPageSearch.results.set("Initech Inc software fintech in Berlin, Germany site:linkedin.com/company", {
    url: "https://www.linkedin.com/company/initech",
    title: "Initech Ltd | LinkedIn",
  });
  deps.fakeLlm.answers.push(answer);
  const id = (await prepare(deps, 3))!;

  await runPreparation(deps, id);

  expect(await deps.applications.get(id)).toMatchObject({ status: "preparing", companyId: 1 });
});
