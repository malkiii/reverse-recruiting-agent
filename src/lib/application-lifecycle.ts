import { z } from "zod";
import type {
  Application,
  ApplicationStatus,
  ApplicationStore,
  CompanyPageSearch,
  CompanyStore,
  DriveFile,
  DriveGateway,
  JobPageReader,
  JobStore,
  LlmGateway,
  PdfReader,
  ResumeFolderStore,
  SavedJob,
} from "./gateways";
import {
  chooseDecisionMakers,
  type DecisionMakerSearchDeps,
  describePerson,
  savedPeopleCooldownReason,
} from "./decision-maker-search";
import { FEED_SOURCE_PREFIX } from "./firecrawl-job-feed";
import { resumesIn } from "./resumes";

export const PREPARE_TIME_LIMIT_MS = 30 * 60_000;

type ClaimDeps = { jobs: JobStore; applications: ApplicationStore; now: () => Date };

export type PrepareDeps = ClaimDeps &
  DecisionMakerSearchDeps & {
    jobPages: JobPageReader;
    resumeFolder: ResumeFolderStore;
    /** The Admin's Drive, reached through the Google connection. */
    drive: () => Promise<DriveGateway>;
    /** The LLM the Admin chose in settings. */
    llm: () => Promise<LlmGateway>;
    /** Reads the chosen Resume PDF as markdown, without the LLM. */
    pdfs: PdfReader;
    companies: CompanyStore;
    companyPageSearch: CompanyPageSearch;
  };

/** The Admin's Prepare: atomically claims the Job's one Application. Null when the Job is unknown or already has one. */
export async function prepare({ jobs, applications, now }: ClaimDeps, jobId: number) {
  if (!(await jobs.get(jobId))) return null;
  return applications.claim(jobId, now());
}

/** The Admin's Retry of a failed Application, resumed from its current step. Null when it isn't failed. */
export async function retry({ applications }: Pick<ClaimDeps, "applications">, applicationId: number) {
  return (await applications.retry(applicationId)) ? applicationId : null;
}

/** The Admin's Cancel at Review: final, and the Job's one Application stays, so the Job can't be Prepared again. */
export async function cancel({ applications }: Pick<ClaimDeps, "applications">, applicationId: number) {
  return applications.cancel(applicationId);
}

const xml = (tag: string, content: string) => `<${tag}>\n${content}\n</${tag}>`;

const CHOOSE_RESUME_INSTRUCTIONS = [
  "You help a job seeker apply to a job.",
  "Read the job page and choose the one resume, by filename, whose target role fits the job best.",
  "Also give up to 3 short industry keywords for the hiring company, the job's location as city and country",
  "(or 'Remote'), and a one-paragraph summary of the job's role, responsibilities and requirements.",
  "Copy resumeFilename exactly from the listed filenames.",
].join(" ");

const chooseResumeSchema = z.object({
  industryKeywords: z.array(z.string()),
  jobLocation: z.string(),
  resumeFilename: z.string(),
  jobSummary: z.string(),
});

/** An expected end to Prepare, shown on the Application rather than failing the Function. */
class Stop extends Error {
  constructor(
    message: string,
    public status: ApplicationStatus = "failed",
  ) {
    super(message);
  }
}

/** The Resumes in the Resume Folder. Stops when there are none, before anything is paid for. */
async function listResumes(deps: PrepareDeps) {
  const folder = await deps.resumeFolder.get();
  if (!folder) throw new Stop("No Resume Folder is chosen: choose one on the dashboard's Google page");
  const resumes = resumesIn(await (await deps.drive()).listFiles(folder.id));
  if (resumes.length === 0) {
    throw new Stop('Your Resume Folder has no Resume: add a PDF whose name ends in "resume" or "CV"');
  }
  return resumes;
}

/**
 * The Job's content. A Job Board Job uses its collected description, as its actor already extracted it.
 * A Feed Job has none, so its Job page is read as markdown. Either ends as Direct Apply when there's nothing to read.
 */
async function readJob(deps: PrepareDeps, job: SavedJob) {
  if (!job.source.startsWith(FEED_SOURCE_PREFIX)) {
    const description = job.description?.trim();
    if (!description) throw new Stop("The Job has no description, so apply through the Job link", "direct-apply");
    return description;
  }
  try {
    const page = (await deps.jobPages.read(job.url)).trim();
    if (page) return page;
    console.warn(`Job page ${job.url}: empty`);
  } catch (error) {
    console.warn(`Job page ${job.url}: couldn't be read:`, error);
  }
  throw new Stop("The Job page couldn't be read, so apply through the Job link", "direct-apply");
}

/** LLM request 1: the Job page and the Resume filenames, for industry keywords, Job location, Resume and Job Summary. */
async function chooseResume(deps: PrepareDeps, job: SavedJob, jobPage: string, resumes: DriveFile[]) {
  const prompt = [
    xml("job_title", job.title),
    xml("company", job.companyName),
    xml("job_page", jobPage),
    xml("resume_filenames", resumes.map(({ name }) => `<resume_filename>${name}</resume_filename>`).join("\n")),
  ].join("\n\n");

  const chosen = await (await deps.llm()).generate({
    instructions: CHOOSE_RESUME_INSTRUCTIONS,
    prompt,
    schema: chooseResumeSchema,
  });
  // A wrong file must never be sent, so an unknown name stops the Application instead of being guessed at.
  const resume = resumes.find(({ name }) => name === chosen.resumeFilename);
  if (!resume) throw new Stop(`The LLM chose "${chosen.resumeFilename}", which isn't one of your Resumes`);

  return {
    industryKeywords: chosen.industryKeywords,
    jobLocation: chosen.jobLocation,
    jobSummary: chosen.jobSummary,
    resumeFileId: resume.id,
    resumeName: resume.name,
    resumeLink: resume.webViewLink,
  };
}

const COMPANY_SUFFIXES = /\b(corporation|limited|corp|gmbh|inc|llc|ltd|plc|co)\b/g;

/** A Company name for matching: lowercased, without "| LinkedIn", punctuation or suffixes such as Inc, LLC and Ltd. */
const matchableName = (name: string) =>
  name
    .toLowerCase()
    .replace("| linkedin", " ")
    .replace(/[^\p{L}\p{N}\s&]/gu, " ")
    .replace(COMPANY_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Whether a search result's title names the Company: one name contains the other. */
function namesMatch(companyName: string, title: string) {
  const company = matchableName(companyName);
  const found = matchableName(title);
  return company !== "" && found !== "" && (company.includes(found) || found.includes(company));
}

type CompanySearchDetails = Pick<Application, "industryKeywords" | "jobLocation">;

/**
 * The Company's LinkedIn page: the one saved on the Job, otherwise a search's first result when its title matches.
 * Ends as Direct Apply when the page can't be confirmed. Returns the Company's ID.
 */
async function findCompany(
  deps: PrepareDeps,
  id: number,
  job: SavedJob,
  { industryKeywords, jobLocation }: CompanySearchDetails,
) {
  let linkedinUrl = job.companyLinkedinUrl;
  if (!linkedinUrl) {
    const where = jobLocation ? ["in", jobLocation] : [];
    const query = [job.companyName, ...(industryKeywords ?? []), ...where, "site:linkedin.com/company"].join(" ");
    console.log(`Application ${id}: searching for the Company page: "${query}"`);
    const result = await deps.companyPageSearch.firstResult(query);
    if (!result || !namesMatch(job.companyName, result.title)) {
      console.log(`Company page search "${query}": no match in ${JSON.stringify(result)}`);
      throw new Stop("The Company's LinkedIn page couldn't be confirmed, so apply through the Job link", "direct-apply");
    }
    linkedinUrl = result.url;
    console.log(`Application ${id}: search found "${result.title}" ${result.url}`);
  } else {
    console.log(`Application ${id}: Company page from the Job: ${linkedinUrl}`);
  }
  return deps.companies.findOrCreate({ name: job.companyName, linkedinUrl });
}

/** Stops before anything is paid for when the Job's Company is already saved and all its people are in Cooldown. */
async function checkSavedPeopleCooldown(deps: PrepareDeps, job: SavedJob) {
  const company = job.companyLinkedinUrl ? await deps.companies.findByLinkedinUrl(job.companyLinkedinUrl) : undefined;
  const reason = company ? await savedPeopleCooldownReason(deps, company.id) : null;
  if (reason) throw new Stop(reason, "all-in-cooldown");
}

const NAME_PLACEHOLDER = "{{name}}";
const RESUME_LINK_PLACEHOLDER = "{{resume_link}}";

const WRITE_COVER_LETTER_INSTRUCTIONS = [
  "You help a job seeker apply to a job by emailing the people who can hire them.",
  "Write an email subject and a short, specific cover letter for the job, from the job summary and the resume.",
  "Only claim experience and skills the resume supports.",
  `Start the first line with a greeting to ${NAME_PLACEHOLDER}, which is replaced with each recipient's name.`,
  `End the letter with ${RESUME_LINK_PLACEHOLDER}, which is replaced with the link to the resume.`,
  "Write plain text, without markdown.",
].join(" ");

const writeCoverLetterSchema = z.object({ subject: z.string(), coverLetter: z.string() });

/** Whether a Cover Letter has {{name}} in its first line and ends with {{resume_link}}, so every email can be filled in. */
function hasPlaceholders(coverLetter: string) {
  const text = coverLetter.trim();
  return text.split("\n")[0].includes(NAME_PLACEHOLDER) && text.endsWith(RESUME_LINK_PLACEHOLDER);
}

/** The chosen Resume PDF, read as markdown without the LLM. */
async function readResume(deps: PrepareDeps, resumeFileId: string) {
  const pdf = await (await deps.drive()).download(resumeFileId);
  const markdown = (await deps.pdfs.toMarkdown(pdf)).trim();
  if (!markdown) throw new Stop("Your Resume has no text to read: export it as a PDF with selectable text");
  return markdown;
}

/** LLM request 2: the Job Summary and Resume markdown, for a subject and a Cover Letter with its placeholders. */
async function writeCoverLetter(deps: PrepareDeps, id: number) {
  const application = await deps.applications.get(id);
  const { jobSummary, resumeFileId } = application ?? {};
  if (!jobSummary || !resumeFileId) throw new Error(`Application ${id} has no Job Summary or Resume`);

  const prompt = [xml("job_summary", jobSummary), xml("resume", await readResume(deps, resumeFileId))].join("\n\n");
  const written = await (await deps.llm()).generate({
    instructions: WRITE_COVER_LETTER_INSTRUCTIONS,
    prompt,
    schema: writeCoverLetterSchema,
  });
  const coverLetter = written.coverLetter.trim();
  if (!hasPlaceholders(coverLetter)) {
    throw new Stop(
      `The LLM's Cover Letter is missing ${NAME_PLACEHOLDER} in its first line or ${RESUME_LINK_PLACEHOLDER} at its end`,
    );
  }
  return { subject: written.subject.trim(), coverLetter };
}

/** Stops before Review when the Resume Folder isn't shared by link, so a recipient never gets a dead Resume link. */
async function checkSharing(deps: PrepareDeps) {
  const folder = await deps.resumeFolder.get();
  if (!folder) throw new Stop("No Resume Folder is chosen: choose one on the dashboard's Google page");
  const drive = await deps.drive();
  if (!(await drive.isSharedByLink(folder.id))) {
    throw new Stop(`Your Resume Folder "${folder.name}" isn't shared as "Anyone with the link": share it, then Retry`);
  }
}

async function runSteps(deps: PrepareDeps, application: Application) {
  const { id } = application;
  const job = await deps.jobs.get(application.jobId);
  if (!job) throw new Error(`No Job ${application.jobId} for Application ${id}`);
  let { currentStep: step, jobPage } = application;
  let details: CompanySearchDetails = application;

  if (step === "read-job") await checkSavedPeopleCooldown(deps, job);

  if (step === "read-job" || step === "choose-resume") {
    const resumes = await listResumes(deps);
    if (step === "read-job" || !jobPage) {
      jobPage = await readJob(deps, job);
      await deps.applications.update(id, { jobPage, currentStep: "choose-resume" });
      console.log(`Application ${id}: read the Job page`);
    }
    const chosen = await chooseResume(deps, job, jobPage, resumes);
    details = chosen;
    step = "find-company-page";
    await deps.applications.update(id, { ...chosen, currentStep: step });
    console.log(`Application ${id}: chose ${chosen.resumeName}`);
  }

  let { companyId } = application;
  if (step === "find-company-page") {
    companyId = await findCompany(deps, id, job, details);
    step = "find-decision-makers";
    await deps.applications.update(id, { companyId, currentStep: step });
    console.log(`Application ${id}: found Company ${companyId}`);
  }

  if (step === "find-decision-makers") {
    const company = companyId === null ? undefined : await deps.companies.get(companyId);
    if (!company) throw new Error(`No Company ${companyId} for Application ${id}`);
    const choice = await chooseDecisionMakers(deps, id, company);
    if (choice.outcome === "no-contacts") {
      throw new Stop("No Decision Maker with an email address was found", "no-contacts");
    }
    if (choice.outcome === "all-in-cooldown") throw new Stop(choice.reason, "all-in-cooldown");
    step = "write-cover-letter";
    await deps.applications.update(id, { currentStep: step });
    console.log(
      `Application ${id}: chose ${choice.decisionMakers.length} Decision Maker(s): ${choice.decisionMakers.map(describePerson).join(", ")}`,
    );
  }

  if (step === "write-cover-letter") {
    const written = await writeCoverLetter(deps, id);
    step = "check-sharing";
    await deps.applications.update(id, { ...written, currentStep: step });
    console.log(`Application ${id}: wrote the Cover Letter`);
  }

  if (step === "check-sharing") {
    await checkSharing(deps);
    await deps.applications.update(id, { status: "in-review" });
    console.log(`Application ${id}: in Review`);
  }
}

/**
 * The prepare-application Function: runs the Application's Prepare steps from its current step.
 * A stop is saved on the Application. Any other error marks it failed and fails the Function.
 */
export async function runPreparation(deps: PrepareDeps, applicationId: number) {
  const application = await deps.applications.get(applicationId);
  if (!application) throw new Error(`No Application ${applicationId}`);
  if (application.status !== "preparing") {
    console.log(`Application ${applicationId}: ${application.status}, nothing to prepare`);
    return;
  }

  try {
    await runSteps(deps, application);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof Stop ? error.status : "failed";
    await deps.applications.update(applicationId, { status, error: message });
    console.log(`Application ${applicationId}: ${status}: ${message}`);
    if (!(error instanceof Stop)) throw error;
  }
}
