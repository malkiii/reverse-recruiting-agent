import { expect, test } from "vitest";
import { cancel, prepare, retry, runPreparation } from "./application-lifecycle";
import {
  FakeActor,
  FakeActorRunStore,
  FakeApplicationStore,
  FakeCompanyPageSearch,
  FakeCompanyStore,
  FakeDecisionMakerStore,
  FakeDrive,
  FakeJobPages,
  FakeJobStore,
  FakeLlm,
  FakePdfReader,
  FakeResumeFolderStore,
  FakeSkippedApifyTokenStore,
} from "./fake-gateways";
import type { EmployeeSearch, FoundEmail, Person } from "./gateways";
import type { JobFunction } from "./schema";

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
  drive.sharedByLink.add("folder");
  drive.contents.set("file-Backend Engineer Resume.pdf", "# Jane Doe\nGo engineer, 5 years of payment APIs.");
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
    employeesActor: new FakeActor<EmployeeSearch, Person>("employees"),
    emailsActor: new FakeActor<string[], FoundEmail>("emails"),
    actorRuns: new FakeActorRunStore(),
    decisionMakers: new FakeDecisionMakerStore(),
    apifyTokens: "token-a,token-b",
    skippedApifyTokens: new FakeSkippedApifyTokenStore(),
    sleep: async () => {},
    pdfs: new FakePdfReader(),
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

const letter = {
  subject: "Backend Engineer at Acme",
  coverLetter: "Hi {{name}},\n\nI build payment APIs in Go.\n\nMy Resume: {{resume_link}}",
};

test("Prepare uses a Job Board Job's collected description and saves the Resume and Job Summary the LLM chose", async () => {
  const deps = await setup();
  deps.fakeLlm.answers.push(answer);
  const id = (await prepare(deps, 1))!;

  await runPreparation(deps, id);

  expect(await deps.applications.get(id)).toMatchObject({
    currentStep: "find-decision-makers",
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
  expect(await deps.applications.get(id)).toMatchObject({ currentStep: "find-decision-makers", companyId: 1 });
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

  expect(await deps.applications.get(id)).toMatchObject({ currentStep: "find-decision-makers", companyId: 1 });
});

const person = (name: string): Person => ({
  name,
  headline: `${name} at Acme`,
  profileUrl: `https://www.linkedin.com/in/${name.toLowerCase().replace(" ", "-")}`,
});

const search = (jobFunction: JobFunction): EmployeeSearch => ({ companyUrl: acmePage.url, jobFunction, maxEmployees: 4 });

type Deps = Awaited<ReturnType<typeof setup>>;

/** The employees actor finds these people for the function. */
function employees(deps: Deps, jobFunction: JobFunction, names: string[]) {
  deps.employeesActor.returns(search(jobFunction), names.map(person));
}

/** The email actor answers a lookup of exactly these names, finding an email for those in `withEmail`. */
function emails(deps: Deps, names: string[], withEmail: string[]) {
  deps.emailsActor.returns(
    names.map((name) => person(name).profileUrl),
    names.map((name) => ({
      profileUrl: person(name).profileUrl,
      email: withEmail.includes(name) ? `${name.toLowerCase()}@acme.com` : null,
    })),
  );
}

/** Prepares the LinkedIn Job through to the Decision Maker search. */
async function prepareToDecisionMakers(deps: Deps) {
  deps.fakeLlm.answers.push(answer, letter);
  const id = (await prepare(deps, 1))!;
  await runPreparation(deps, id);
  return id;
}

const names = (people: { name: string }[]) => people.map(({ name }) => name);

test("Decision Makers are searched function by function until 4 have emails, asking each run for 4", async () => {
  const deps = await setup();
  employees(deps, "12", ["Ann", "Bob"]);
  emails(deps, ["Ann", "Bob"], ["Ann", "Bob"]);
  employees(deps, "9", ["Cy", "Dee"]);
  emails(deps, ["Cy", "Dee"], ["Cy"]);
  employees(deps, "18", ["Eve", "Fay"]);
  emails(deps, ["Eve"], ["Eve"]);

  const id = await prepareToDecisionMakers(deps);

  expect(deps.employeesActor.inputs).toEqual([search("12"), search("9"), search("18")]);
  // Emails are looked up only for as many people as are still needed, so Fay isn't looked up.
  expect(deps.emailsActor.inputs).toEqual([
    [person("Ann").profileUrl, person("Bob").profileUrl],
    [person("Cy").profileUrl, person("Dee").profileUrl],
    [person("Eve").profileUrl],
  ]);
  expect(names(await deps.decisionMakers.listForApplication(id))).toEqual(["Ann", "Bob", "Cy", "Eve"]);
  expect(names(await deps.decisionMakers.listForCompany(1))).toEqual(["Ann", "Bob", "Cy", "Dee", "Eve", "Fay"]);
  expect(await deps.applications.get(id)).toMatchObject({
    status: "in-review",
    error: null,
  });
});

test("everyone found is saved to the Company, with their function and any email", async () => {
  const deps = await setup();
  employees(deps, "12", ["Ann", "Bob", "Cy"]);
  emails(deps, ["Ann", "Bob", "Cy"], ["Ann"]);

  await prepareToDecisionMakers(deps);

  expect(await deps.decisionMakers.listForCompany(1)).toMatchObject([
    { name: "Ann", headline: "Ann at Acme", email: "ann@acme.com", jobFunction: "12", foundAt: now },
    { name: "Bob", email: null, jobFunction: "12" },
    { name: "Cy", email: null, jobFunction: "12" },
  ]);
  expect(await deps.decisionMakers.peopleFoundAt(1)).toEqual(now);
});

test("people are kept unique by name, so someone found again under another function isn't looked up twice", async () => {
  const deps = await setup();
  employees(deps, "12", ["Ann"]);
  emails(deps, ["Ann"], []);
  employees(deps, "9", ["ann ", "Bob"]);
  emails(deps, ["Bob"], ["Bob"]);

  const id = await prepareToDecisionMakers(deps);

  expect(deps.emailsActor.inputs).toEqual([[person("Ann").profileUrl], [person("Bob").profileUrl]]);
  expect(names(await deps.decisionMakers.listForCompany(1))).toEqual(["Ann", "Bob"]);
  expect(names(await deps.decisionMakers.listForApplication(id))).toEqual(["Bob"]);
});

test("the search stops with 1-3 Decision Makers once all 5 functions are done, without searching any", async () => {
  const deps = await setup();
  employees(deps, "12", ["Ann", "Bob"]);
  emails(deps, ["Ann", "Bob"], ["Ann"]);
  employees(deps, "20", ["Cy"]);
  emails(deps, ["Cy"], ["Cy"]);

  const id = await prepareToDecisionMakers(deps);

  expect(deps.employeesActor.inputs).toEqual([search("12"), search("9"), search("18"), search("19"), search("20")]);
  expect(names(await deps.decisionMakers.listForApplication(id))).toEqual(["Ann", "Cy"]);
  expect(await deps.applications.get(id)).toMatchObject({ status: "in-review" });
});

test("any is searched once, last, when nobody with an email was found in the 5 functions", async () => {
  const deps = await setup();
  employees(deps, "12", ["Ann"]);
  emails(deps, ["Ann"], []);
  employees(deps, "any", ["Ann", "Bob"]);
  emails(deps, ["Bob"], ["Bob"]);

  const id = await prepareToDecisionMakers(deps);

  expect(deps.employeesActor.inputs.map(({ jobFunction }) => jobFunction)).toEqual(["12", "9", "18", "19", "20", "any"]);
  expect(await deps.decisionMakers.listForApplication(id)).toMatchObject([{ name: "Bob", jobFunction: "any" }]);
});

test("nobody with an email ends the Application as No Contacts, still saving the people found", async () => {
  const deps = await setup();
  employees(deps, "18", ["Ann"]);
  emails(deps, ["Ann"], []);

  const id = await prepareToDecisionMakers(deps);

  expect(deps.employeesActor.inputs).toHaveLength(6);
  expect(await deps.applications.get(id)).toMatchObject({
    status: "no-contacts",
    currentStep: "find-decision-makers",
    error: "No Decision Maker with an email address was found",
  });
  expect(names(await deps.decisionMakers.listForCompany(1))).toEqual(["Ann"]);
  expect(await deps.decisionMakers.listForApplication(id)).toEqual([]);
});

test("each actor run is saved before it's polled, with the Application and what it's for", async () => {
  const deps = await setup();
  employees(deps, "12", ["Ann", "Bob", "Cy", "Dee"]);
  emails(deps, ["Ann", "Bob", "Cy", "Dee"], ["Ann", "Bob", "Cy", "Dee"]);
  deps.employeesActor.statuses.set(JSON.stringify(search("12")), ["running", "running", "succeeded"]);

  const id = await prepareToDecisionMakers(deps);

  expect(await deps.actorRuns.listForApplication(id)).toMatchObject([
    { runId: "employees-run-1", actor: "employees", token: "token-a", applicationId: id, purpose: "employees:12" },
    { runId: "emails-run-1", actor: "emails", token: "token-b", applicationId: id, purpose: "emails:12" },
  ]);
  expect(await deps.actorRuns.listUnfinished()).toEqual([]);
  expect(names(await deps.decisionMakers.listForApplication(id))).toHaveLength(4);
});

test("a Retry resumes the actor run still going instead of starting another", async () => {
  const deps = await setup();
  employees(deps, "12", ["Ann", "Bob", "Cy", "Dee"]);
  emails(deps, ["Ann", "Bob", "Cy", "Dee"], ["Ann", "Bob", "Cy", "Dee"]);
  // Still running after every poll the Function has, then done by the Retry.
  deps.employeesActor.statuses.set(JSON.stringify(search("12")), [...Array(121).fill("running"), "succeeded"]);

  deps.fakeLlm.answers.push(answer, letter);
  const id = (await prepare(deps, 1))!;
  await expect(runPreparation(deps, id)).rejects.toThrow("is still running");
  expect(await deps.applications.get(id)).toMatchObject({
    status: "failed",
    error: "Actor run employees-run-1 (employees:12) is still running: Retry to resume it",
  });

  await retry(deps, id);
  await runPreparation(deps, id);

  expect(deps.employeesActor.started).toHaveLength(1);
  // LLM request 1 isn't asked again: only the Cover Letter is written after the Retry.
  expect(deps.fakeLlm.requests).toHaveLength(2);
  expect(await deps.applications.get(id)).toMatchObject({ status: "in-review" });
});

test("a Retry rereads finished runs and starts again only the run that failed", async () => {
  const deps = await setup();
  employees(deps, "12", ["Ann"]);
  emails(deps, ["Ann"], ["Ann"]);
  employees(deps, "9", ["Bob"]);
  emails(deps, ["Bob"], ["Bob"]);
  deps.employeesActor.statuses.set(JSON.stringify(search("9")), ["failed"]);
  deps.fakeLlm.answers.push(answer, letter);
  const id = (await prepare(deps, 1))!;
  await expect(runPreparation(deps, id)).rejects.toThrow("failed: Retry to start it again");
  expect(await deps.applications.get(id)).toMatchObject({ status: "failed" });

  deps.employeesActor.statuses.clear();
  await retry(deps, id);
  await runPreparation(deps, id);

  expect(deps.employeesActor.inputs.map(({ jobFunction }) => jobFunction)).toEqual(["12", "9", "9", "18", "19", "20"]);
  expect(deps.emailsActor.started).toHaveLength(2);
  expect(names(await deps.decisionMakers.listForApplication(id))).toEqual(["Ann", "Bob"]);
});

test("emails are matched to people by profile URL, ignoring how the email actor writes it, and anyone missing is skipped", async () => {
  const deps = await setup();
  employees(deps, "12", ["Ann", "Bob"]);
  deps.emailsActor.returns(
    [person("Ann").profileUrl, person("Bob").profileUrl],
    [{ profileUrl: "http://linkedin.com/in/Ann/", email: "ann@acme.com" }],
  );

  const id = await prepareToDecisionMakers(deps);

  expect(await deps.decisionMakers.listForApplication(id)).toMatchObject([{ name: "Ann", email: "ann@acme.com" }]);
  expect(await deps.decisionMakers.listForCompany(1)).toMatchObject([{ name: "Ann" }, { name: "Bob", email: null }]);
});

test("a run that fails again after a Retry fails the Application again", async () => {
  const deps = await setup();
  deps.employeesActor.statuses.set(JSON.stringify(search("12")), ["failed"]);
  deps.fakeLlm.answers.push(answer);
  const id = (await prepare(deps, 1))!;
  await expect(runPreparation(deps, id)).rejects.toThrow("employees-run-1 (employees:12) failed");

  await retry(deps, id);
  await expect(runPreparation(deps, id)).rejects.toThrow("employees-run-2 (employees:12) failed");

  expect(await deps.applications.get(id)).toMatchObject({ status: "failed", currentStep: "find-decision-makers" });
});

/** Acme saved with these people, found at the given time: name → email, null for none. */
async function savedPeople(deps: Deps, foundAt: Date, people: Record<string, string | null>) {
  const companyId = await deps.companies.findOrCreate({ name: "Acme", linkedinUrl: acmePage.url });
  await deps.decisionMakers.save(
    companyId,
    Object.entries(people).map(([name, email]) => ({ ...person(name), email, jobFunction: "12" as const })),
    foundAt,
  );
}

const justUnderSixMonthsAgo = new Date("2026-05-04T10:00:00.001Z");
const sixMonthsAgo = new Date("2026-05-04T10:00:00Z");

test("saved people under 6 months old are reused with no actor runs, skipping those with no email", async () => {
  const deps = await setup();
  await savedPeople(deps, justUnderSixMonthsAgo, { Ann: null, Bob: "bob@acme.com", Cy: "cy@acme.com" });

  const id = await prepareToDecisionMakers(deps);

  expect(deps.employeesActor.started).toEqual([]);
  expect(deps.emailsActor.started).toEqual([]);
  expect(names(await deps.decisionMakers.listForApplication(id))).toEqual(["Bob", "Cy"]);
  expect(await deps.applications.get(id)).toMatchObject({ status: "in-review" });
});

test("saved people 6 months old trigger a People Refresh, which chooses only from the people found again", async () => {
  const deps = await setup();
  await savedPeople(deps, sixMonthsAgo, { Ann: "ann@acme.com" });
  employees(deps, "12", ["Bob"]);
  emails(deps, ["Bob"], ["Bob"]);

  const id = await prepareToDecisionMakers(deps);

  expect(deps.employeesActor.inputs.map(({ jobFunction }) => jobFunction)).toEqual(["12", "9", "18", "19", "20"]);
  expect(names(await deps.decisionMakers.listForApplication(id))).toEqual(["Bob"]);
  expect(await deps.decisionMakers.peopleFoundAt(1)).toEqual(now);
});

test("saved people with no email aren't retried before the People Refresh, so the Application ends as No Contacts", async () => {
  const deps = await setup();
  await savedPeople(deps, justUnderSixMonthsAgo, { Ann: null, Bob: null });

  const id = await prepareToDecisionMakers(deps);

  expect(deps.employeesActor.started).toEqual([]);
  expect(deps.emailsActor.started).toEqual([]);
  expect(await deps.applications.get(id)).toMatchObject({ status: "no-contacts" });
});

const justUnderThirtyDaysAgo = new Date("2026-10-05T10:00:00.001Z");
const thirtyDaysAgo = new Date("2026-10-05T10:00:00Z");

test("a Decision Maker emailed under 30 days ago is in Cooldown and left out, but one emailed 30 days ago isn't", async () => {
  const deps = await setup();
  await savedPeople(deps, justUnderSixMonthsAgo, { Ann: "ann@acme.com", Bob: "bob@acme.com", Cy: "cy@acme.com" });
  deps.decisionMakers.emailed("Ann", justUnderThirtyDaysAgo);
  deps.decisionMakers.emailed("Bob", thirtyDaysAgo);

  const id = await prepareToDecisionMakers(deps);

  expect(names(await deps.decisionMakers.listForApplication(id))).toEqual(["Bob", "Cy"]);
});

test("when every saved person is in Cooldown, the Application stops at the start, before anything is paid for", async () => {
  const deps = await setup();
  await savedPeople(deps, justUnderSixMonthsAgo, { Ann: "ann@acme.com", Bob: "bob@acme.com", Cy: null });
  deps.decisionMakers.emailed("Ann", justUnderThirtyDaysAgo);
  deps.decisionMakers.emailed("Bob", new Date("2026-11-01T09:00:00Z"));
  await deps.jobs.save([
    { ...linkedInJob, title: "Platform Engineer", url: "https://www.linkedin.com/jobs/view/3", companyLinkedinUrl: acmePage.url },
  ]);
  const id = (await prepare(deps, 3))!;

  await runPreparation(deps, id);

  expect(await deps.applications.get(id)).toMatchObject({
    status: "all-in-cooldown",
    currentStep: "read-job",
    error: "Every Decision Maker is in Cooldown, emailed: Ann 29 days ago, Bob 3 days ago",
  });
  expect(deps.fakeLlm.requests).toEqual([]);
  expect(deps.employeesActor.started).toEqual([]);
});

test("newly found people in Cooldown are left out after the search, stopping the Application when that's everyone", async () => {
  const deps = await setup();
  await savedPeople(deps, sixMonthsAgo, { Ann: "ann@acme.com" });
  deps.decisionMakers.emailed("Ann", new Date("2026-11-02T10:00:00Z"));
  employees(deps, "12", ["Ann"]);
  emails(deps, ["Ann"], ["Ann"]);

  const id = await prepareToDecisionMakers(deps);

  expect(deps.employeesActor.started).not.toEqual([]);
  expect(await deps.applications.get(id)).toMatchObject({
    status: "all-in-cooldown",
    currentStep: "find-decision-makers",
    error: "Every Decision Maker is in Cooldown, emailed: Ann 2 days ago",
  });
});


/** The Admin's saved Decision Makers at Acme, so the search runs no actors. */
async function saveAcmePeople(deps: Deps) {
  const companyId = await deps.companies.findOrCreate({ name: "Acme", linkedinUrl: acmePage.url });
  await deps.decisionMakers.save(
    companyId,
    [{ ...person("Ann"), email: "ann@acme.com", jobFunction: "12" }],
    new Date("2026-11-01T00:00:00Z"),
  );
}

test("once Decision Makers are found, LLM request 2 writes the subject and Cover Letter from the Job Summary and Resume, then the Application is in Review", async () => {
  const deps = await setup();
  await saveAcmePeople(deps);
  deps.fakeLlm.answers.push(answer, letter);
  const id = (await prepare(deps, 1))!;

  await runPreparation(deps, id);

  expect(deps.fakeLlm.requests).toHaveLength(2);
  const { prompt } = deps.fakeLlm.requests[1];
  expect(prompt).toContain(`<job_summary>\n${answer.jobSummary}\n</job_summary>`);
  expect(prompt).toContain("<resume>\n# Jane Doe\nGo engineer, 5 years of payment APIs.\n</resume>");
  expect(deps.fakeDrive.downloads).toEqual(["file-Backend Engineer Resume.pdf"]);
  expect(await deps.applications.get(id)).toMatchObject({
    status: "in-review",
    error: null,
    subject: letter.subject,
    coverLetter: letter.coverLetter,
  });
});

test("the Cover Letter isn't written when no Decision Maker is found, so the Application doesn't pay for it", async () => {
  const deps = await setup();
  for (const jobFunction of ["12", "9", "18", "19", "20", "any"] as const) employees(deps, jobFunction, []);
  deps.fakeLlm.answers.push(answer, letter);
  const id = (await prepare(deps, 1))!;

  await runPreparation(deps, id);

  expect(await deps.applications.get(id)).toMatchObject({ status: "no-contacts", subject: null, coverLetter: null });
  expect(deps.fakeLlm.requests).toHaveLength(1);
  expect(deps.fakeDrive.downloads).toEqual([]);
});

test.each([
  ["no {{name}}", "Hi there,\n\nI build APIs.\n\n{{resume_link}}"],
  ["{{name}} after the first line", "Hi,\n{{name}}, I build APIs.\n\n{{resume_link}}"],
  ["no {{resume_link}}", "Hi {{name}},\n\nI build APIs."],
  ["{{resume_link}} before the end", "Hi {{name}},\n\n{{resume_link}}\n\nThanks!"],
])("a Cover Letter with %s fails the Application before Review", async (_, coverLetter) => {
  const deps = await setup();
  await saveAcmePeople(deps);
  deps.fakeLlm.answers.push(answer, { ...letter, coverLetter });
  const id = (await prepare(deps, 1))!;

  await runPreparation(deps, id);

  expect(await deps.applications.get(id)).toMatchObject({
    status: "failed",
    currentStep: "write-cover-letter",
    coverLetter: null,
    error: "The LLM's Cover Letter is missing {{name}} in its first line or {{resume_link}} at its end",
  });
});

test("a Resume Folder not shared by link stops the Application before Review, and a Retry after sharing doesn't write the letter again", async () => {
  const deps = await setup();
  await saveAcmePeople(deps);
  deps.fakeDrive.sharedByLink.clear();
  deps.fakeLlm.answers.push(answer, letter);
  const id = (await prepare(deps, 1))!;

  await runPreparation(deps, id);
  expect(await deps.applications.get(id)).toMatchObject({
    status: "failed",
    currentStep: "check-sharing",
    coverLetter: letter.coverLetter,
    error: 'Your Resume Folder "Resumes" isn\'t shared as "Anyone with the link": share it, then Retry',
  });

  deps.fakeDrive.sharedByLink.add("folder");
  await retry(deps, id);
  await runPreparation(deps, id);

  expect(await deps.applications.get(id)).toMatchObject({ status: "in-review", error: null });
  expect(deps.fakeLlm.requests).toHaveLength(2);
});

test("Cancel is final: a cancelled Application can't be cancelled, retried or Prepared again", async () => {
  const deps = await setup();
  await saveAcmePeople(deps);
  deps.fakeLlm.answers.push(answer, letter);
  const id = (await prepare(deps, 1))!;
  await runPreparation(deps, id);

  expect(await cancel(deps, id)).toBe(true);
  expect(await cancel(deps, id)).toBe(false);
  expect(await retry(deps, id)).toBeNull();
  expect(await prepare(deps, 1)).toBeNull();
  await runPreparation(deps, id);

  expect(await deps.applications.list()).toMatchObject([{ id, status: "cancelled" }]);
});

test("only an Application in Review can be cancelled", async () => {
  const deps = await setup();
  const id = (await prepare(deps, 1))!;

  expect(await cancel(deps, id)).toBe(false);
  expect(await deps.applications.get(id)).toMatchObject({ status: "preparing" });
});
