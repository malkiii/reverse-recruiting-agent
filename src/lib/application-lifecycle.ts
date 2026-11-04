import { z } from "zod";
import type {
  Application,
  ApplicationStatus,
  ApplicationStore,
  DriveFile,
  DriveGateway,
  JobPageReader,
  JobStore,
  LlmGateway,
  ResumeFolderStore,
  SavedJob,
} from "./gateways";
import { FEED_SOURCE_PREFIX } from "./firecrawl-job-feed";
import { resumesIn } from "./resumes";

export const PREPARE_TIME_LIMIT_MS = 30 * 60_000;

type ClaimDeps = { jobs: JobStore; applications: ApplicationStore; now: () => Date };

export type PrepareDeps = ClaimDeps & {
  jobPages: JobPageReader;
  resumeFolder: ResumeFolderStore;
  /** The Admin's Drive, reached through the Google connection. */
  drive: () => Promise<DriveGateway>;
  /** The LLM the Admin chose in settings. */
  llm: () => Promise<LlmGateway>;
};

/** The Admin's Prepare: atomically claims the Job's one Application. Null when the Job is unknown or already has one. */
export async function prepare({ jobs, applications, now }: ClaimDeps, jobId: number) {
  if (!(await jobs.get(jobId))) return null;
  return applications.claim(jobId, now());
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
 * The Job page as markdown. When it can't be read, a Job Board Job falls back to its collected description,
 * and a Feed Job ends as Direct Apply.
 */
async function readJob(deps: PrepareDeps, job: SavedJob) {
  try {
    const page = (await deps.jobPages.read(job.url)).trim();
    if (page) return page;
    console.warn(`Job page ${job.url}: empty`);
  } catch (error) {
    console.warn(`Job page ${job.url}: couldn't be read:`, error);
  }
  const description = job.source.startsWith(FEED_SOURCE_PREFIX) ? null : job.description?.trim();
  if (!description) throw new Stop("The Job page couldn't be read, so apply through the Job link", "direct-apply");
  return description;
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

async function runSteps(deps: PrepareDeps, application: Application) {
  const { id } = application;
  const job = await deps.jobs.get(application.jobId);
  if (!job) throw new Error(`No Job ${application.jobId} for Application ${id}`);
  const resumes = await listResumes(deps);

  let { jobPage } = application;
  if (application.currentStep === "read-job" || !jobPage) {
    jobPage = await readJob(deps, job);
    await deps.applications.update(id, { jobPage, currentStep: "choose-resume" });
    console.log(`Application ${id}: read the Job page`);
  }

  const chosen = await chooseResume(deps, job, jobPage, resumes);
  await deps.applications.update(id, { ...chosen, currentStep: "find-company-page" });
  console.log(`Application ${id}: chose ${chosen.resumeName}`);
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
