import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { applicationAsOf, cancel, edit, type EditResult, removeDecisionMaker } from "@/lib/application-lifecycle";
import { startFunction } from "@/lib/dashboard-functions";
import { dashboardGoogle } from "@/lib/dashboard-google";
import {
  drizzleApplicationStore,
  drizzleCompanyStore,
  drizzleDecisionMakerStore,
  drizzleFunctionRunStore,
  drizzleJobStore,
  drizzleStepLogStore,
} from "@/lib/drizzle";
import { parseDashboardEnv } from "@/lib/env";
import { runAsOf } from "@/lib/function-runs";
import type { Application, ApplicationStep, DriveFile, StepLog } from "@/lib/gateways";
import { GoogleConnectionError } from "@/lib/google-connection";
import { resumesIn } from "@/lib/resumes";
import { PREPARE_APPLICATION, SEND_APPLICATION } from "@/lib/schema";

const STEP_NAMES: Record<ApplicationStep, string> = {
  "read-job": "Reading the Job page",
  "choose-resume": "Choosing a Resume",
  "find-company-page": "Finding the Company's LinkedIn page",
  "find-decision-makers": "Finding Decision Makers",
  "write-cover-letter": "Writing the Cover Letter",
  "check-sharing": "Checking the Resume Folder's sharing",
  send: "Sending",
};

const applicationPath = (applicationId: number) => `/applications/${applicationId}`;

/** Back to the Application page, showing why the action was refused when it was. */
function backToApplication(applicationId: number, error?: string): never {
  revalidatePath(applicationPath(applicationId));
  redirect(error ? `${applicationPath(applicationId)}?error=${encodeURIComponent(error)}` : applicationPath(applicationId));
}

const applicationStore = () => drizzleApplicationStore(parseDashboardEnv(process.env).DATABASE_URL);

async function retryApplication(formData: FormData) {
  "use server";

  const applicationId = Number(formData.get("applicationId"));
  // A failed Send is resumed by send-application, anything else by prepare-application.
  // A 409 means it's no longer failed, such as after a double click, which the refreshed page shows.
  const response =
    formData.get("currentStep") === "send"
      ? await startFunction(SEND_APPLICATION, { applicationId, retry: true })
      : await startFunction(PREPARE_APPLICATION, { applicationId });
  backToApplication(applicationId, response.status === 400 ? response.error : undefined);
}

async function cancelApplication(formData: FormData) {
  "use server";

  const applicationId = Number(formData.get("applicationId"));
  // False when it's no longer in Review, such as after a double click, which the refreshed page shows.
  await cancel({ applications: applicationStore() }, applicationId);
  backToApplication(applicationId);
}

async function saveReview(formData: FormData) {
  "use server";

  const applicationId = Number(formData.get("applicationId"));
  const resumeFileId = String(formData.get("resumeFileId") ?? "");
  // Drive is only asked when the Resume was switched.
  const switched = resumeFileId !== "" && resumeFileId !== formData.get("currentResumeFileId");
  let result: EditResult;
  try {
    result = await edit({ applications: applicationStore(), ...dashboardGoogle() }, applicationId, {
      subject: String(formData.get("subject") ?? ""),
      coverLetter: String(formData.get("coverLetter") ?? ""),
      ...(switched && { resumeFileId }),
    });
  } catch (problem) {
    if (!(problem instanceof GoogleConnectionError)) throw problem;
    result = { saved: false, error: problem.message };
  }
  backToApplication(applicationId, result.saved ? undefined : result.error);
}

async function removeDecisionMakerAction(formData: FormData) {
  "use server";

  const applicationId = Number(formData.get("applicationId"));
  const result = await removeDecisionMaker(
    {
      applications: applicationStore(),
      decisionMakers: drizzleDecisionMakerStore(parseDashboardEnv(process.env).DATABASE_URL),
    },
    applicationId,
    Number(formData.get("decisionMakerId")),
  );
  backToApplication(applicationId, result.saved ? undefined : result.error);
}

async function sendApplication(formData: FormData) {
  "use server";

  const applicationId = Number(formData.get("applicationId"));
  // A 409 means it's no longer in Review, such as after a double click, which the refreshed page shows.
  const response = await startFunction(SEND_APPLICATION, { applicationId });
  backToApplication(applicationId, response.status === 400 ? response.error : undefined);
}

/** The Resumes the Admin can switch to. Only the current one when Google can't be reached. */
async function listResumes(application: Application): Promise<DriveFile[]> {
  const current: DriveFile[] = application.resumeFileId
    ? [
        {
          id: application.resumeFileId,
          name: application.resumeName ?? application.resumeFileId,
          mimeType: "application/pdf",
          webViewLink: application.resumeLink ?? "",
        },
      ]
    : [];
  try {
    const google = dashboardGoogle();
    const folder = await google.resumeFolder.get();
    if (!folder) return current;
    const resumes = resumesIn(await (await google.drive()).listFiles(folder.id));
    return resumes.some(({ id }) => id === application.resumeFileId) ? resumes : [...current, ...resumes];
  } catch (problem) {
    console.warn("The Resumes couldn't be listed:", problem);
    return current;
  }
}

/** Each attempt at each step, oldest first. A running attempt whose Function was killed shows as failed. */
function StepLogs({ logs, stalled }: { logs: StepLog[]; stalled: boolean }) {
  return (
    <>
      <h2>Step logs</h2>
      <table>
        <thead>
          <tr>
            <th>Step</th>
            <th>Attempt</th>
            <th>Status</th>
            <th>Started</th>
            <th>Finished</th>
            <th>Result or error</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{STEP_NAMES[log.step]}</td>
              <td>{log.attempt}</td>
              <td>{log.status === "running" && stalled ? "failed" : log.status}</td>
              <td>{log.startedAt.toLocaleString()}</td>
              <td>{log.finishedAt?.toLocaleString()}</td>
              <td>{log.error ?? log.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ReviewForm({ application, resumes }: { application: Application; resumes: DriveFile[] }) {
  return (
    <form action={saveReview}>
      <h2>Edit</h2>
      <input type="hidden" name="applicationId" value={application.id} />
      <input type="hidden" name="currentResumeFileId" value={application.resumeFileId ?? ""} />
      <p>
        <label>
          Resume{" "}
          <select name="resumeFileId" defaultValue={application.resumeFileId ?? undefined}>
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.name}
              </option>
            ))}
          </select>
        </label>
      </p>
      <p>
        <label>
          Subject <input name="subject" defaultValue={application.subject ?? ""} required size={60} />
        </label>
      </p>
      <p>
        <label>
          Cover Letter
          <br />
          <textarea name="coverLetter" defaultValue={application.coverLetter ?? ""} required rows={16} cols={80} />
        </label>
      </p>
      <p>
        Keep <code>{"{{name}}"}</code> in the first line and end with <code>{"{{resume_link}}"}</code>.
      </p>
      <button type="submit">Save</button>
    </form>
  );
}

export default async function ApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await connection();
  const id = Number((await params).id);
  const { error } = await searchParams;
  const { DATABASE_URL } = parseDashboardEnv(process.env);
  const saved = Number.isInteger(id) ? await drizzleApplicationStore(DATABASE_URL).get(id) : undefined;
  if (!saved) notFound();

  const inReview = saved.status === "in-review";
  const [job, runs, decisionMakers, company, resumes, logs] = await Promise.all([
    drizzleJobStore(DATABASE_URL).get(saved.jobId),
    drizzleFunctionRunStore(DATABASE_URL).listForApplication(id),
    drizzleDecisionMakerStore(DATABASE_URL).listForApplication(id),
    saved.companyId === null ? undefined : drizzleCompanyStore(DATABASE_URL).get(saved.companyId),
    inReview ? listResumes(saved) : [],
    drizzleStepLogStore(DATABASE_URL).listForApplication(id),
  ]);
  const now = new Date();
  // Shown as failed when its Function passed its time limit, so it can be retried.
  const application = applicationAsOf(saved, runs, now);
  const stalled = application !== saved;
  // Refreshes only while a Function is working on it, so a killed Function doesn't refresh forever.
  const working = runs.some((run) => runAsOf(run, now).status === "running");
  const sending = application.status === "sending" || application.status === "sent" || application.currentStep === "send";

  return (
    <main>
      {working && <meta httpEquiv="refresh" content="5" />}
      <h1>Application</h1>
      <nav>
        <Link href="/jobs">Jobs</Link>
      </nav>

      {job && (
        <p>
          <a href={job.url}>{job.title}</a> at {job.companyName}, {job.location} ({job.source})
        </p>
      )}

      <p>
        Status: <strong>{application.status}</strong>
        {(application.status === "preparing" || application.status === "sending") && (
          <> &middot; {STEP_NAMES[application.currentStep]}&hellip;</>
        )}
        {application.status === "failed" && <> &middot; Failed at: {STEP_NAMES[application.currentStep]}</>}
      </p>
      {error && <p role="alert">{error}</p>}
      {application.error && <p role="alert">{application.error}</p>}
      {application.status === "failed" && (
        <form action={retryApplication}>
          <input type="hidden" name="applicationId" value={application.id} />
          <input type="hidden" name="currentStep" value={application.currentStep} />
          <button type="submit">Retry</button>
        </form>
      )}
      {application.status === "direct-apply" && job && (
        <p>
          Apply directly through <a href={job.url}>the Job link</a>
          {application.resumeLink && (
            <>
              {" "}
              with <a href={application.resumeLink}>{application.resumeName}</a>
            </>
          )}
          .
        </p>
      )}

      {application.resumeLink && (
        <p>
          Resume: <a href={application.resumeLink}>{application.resumeName}</a>
        </p>
      )}
      {company && (
        <p>
          Company page: <a href={company.linkedinUrl}>{company.name}</a>
        </p>
      )}
      {application.jobLocation && <p>Job location: {application.jobLocation}</p>}
      {application.industryKeywords && application.industryKeywords.length > 0 && (
        <p>Industry: {application.industryKeywords.join(", ")}</p>
      )}
      {application.jobSummary && (
        <>
          <h2>Job Summary</h2>
          <p>{application.jobSummary}</p>
        </>
      )}

      {decisionMakers.length > 0 && (
        <>
          <h2>Decision Makers</h2>
          <ul>
            {decisionMakers.map((decisionMaker) => (
              <li key={decisionMaker.id}>
                <a href={decisionMaker.profileUrl}>{decisionMaker.name}</a>, {decisionMaker.headline} &middot;{" "}
                {decisionMaker.email}
                {sending && (
                  <> &middot; {decisionMaker.sentAt ? `sent ${decisionMaker.sentAt.toLocaleString()}` : "not sent"}</>
                )}
                {inReview && decisionMakers.length > 1 && (
                  <form action={removeDecisionMakerAction} style={{ display: "inline" }}>
                    <input type="hidden" name="applicationId" value={application.id} />
                    <input type="hidden" name="decisionMakerId" value={decisionMaker.id} />{" "}
                    <button type="submit">Remove</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {application.coverLetter && (
        <>
          <h2>Cover Letter</h2>
          <p>
            Subject: <strong>{application.subject}</strong>
          </p>
          <pre style={{ whiteSpace: "pre-wrap" }}>{application.coverLetter}</pre>
        </>
      )}

      {inReview && (
        <>
          <ReviewForm application={application} resumes={resumes} />
          <h2>Send or Cancel</h2>
          <form action={sendApplication}>
            <input type="hidden" name="applicationId" value={application.id} />
            <button type="submit">Send</button>
          </form>
          <p>Send emails each Decision Maker from your Gmail and locks the Application.</p>
          <form action={cancelApplication}>
            <input type="hidden" name="applicationId" value={application.id} />
            <button type="submit">Cancel</button>
          </form>
          <p>Cancel is final: this Job can't be Prepared again.</p>
        </>
      )}

      {logs.length > 0 && <StepLogs logs={logs} stalled={stalled} />}

      {runs.length > 0 && (
        <p>
          <Link href="/function-runs">Function runs</Link>
        </p>
      )}
    </main>
  );
}
