import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cancel } from "@/lib/application-lifecycle";
import { startFunction } from "@/lib/dashboard-functions";
import {
  drizzleApplicationStore,
  drizzleCompanyStore,
  drizzleDecisionMakerStore,
  drizzleJobStore,
  listFunctionRunsForApplication,
} from "@/lib/drizzle";
import { parseDashboardEnv } from "@/lib/env";
import { runAsOf } from "@/lib/function-runs";
import type { PrepareStep } from "@/lib/gateways";
import { PREPARE_APPLICATION } from "@/lib/schema";

const STEP_NAMES: Record<PrepareStep, string> = {
  "read-job": "Reading the Job page",
  "choose-resume": "Choosing a Resume",
  "find-company-page": "Finding the Company's LinkedIn page",
  "find-decision-makers": "Finding Decision Makers",
  "write-cover-letter": "Writing the Cover Letter",
  "check-sharing": "Checking the Resume Folder's sharing",
};

async function retryApplication(formData: FormData) {
  "use server";

  const applicationId = Number(formData.get("applicationId"));
  // A 409 means it's no longer failed, such as after a double click, which the refreshed page shows.
  await startFunction(PREPARE_APPLICATION, { applicationId });
  revalidatePath(`/applications/${applicationId}`);
}

async function cancelApplication(formData: FormData) {
  "use server";

  const applicationId = Number(formData.get("applicationId"));
  // False when it's no longer in Review, such as after a double click, which the refreshed page shows.
  await cancel({ applications: drizzleApplicationStore(parseDashboardEnv(process.env).DATABASE_URL) }, applicationId);
  revalidatePath(`/applications/${applicationId}`);
}

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id);
  const { DATABASE_URL } = parseDashboardEnv(process.env);
  const application = Number.isInteger(id) ? await drizzleApplicationStore(DATABASE_URL).get(id) : undefined;
  if (!application) notFound();

  const [job, runs, decisionMakers, company] = await Promise.all([
    drizzleJobStore(DATABASE_URL).get(application.jobId),
    listFunctionRunsForApplication(DATABASE_URL, id),
    drizzleDecisionMakerStore(DATABASE_URL).listForApplication(id),
    application.companyId === null ? undefined : drizzleCompanyStore(DATABASE_URL).get(application.companyId),
  ]);
  const now = new Date();
  // Refreshes only while a Function is working on it, so a killed Function doesn't refresh forever.
  const working = runs.some((run) => runAsOf(run, now).status === "running");

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
        {application.status === "preparing" &&
          (working ? (
            <> &middot; {STEP_NAMES[application.currentStep]}&hellip;</>
          ) : (
            <> &middot; Stopped before: {STEP_NAMES[application.currentStep]}</>
          ))}
      </p>
      {application.error && <p role="alert">{application.error}</p>}
      {application.status === "failed" && (
        <form action={retryApplication}>
          <input type="hidden" name="applicationId" value={application.id} />
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

      {application.status === "in-review" && (
        <>
          <button type="button" disabled title="Send arrives in a later version">
            Send
          </button>
          <form action={cancelApplication}>
            <input type="hidden" name="applicationId" value={application.id} />
            <button type="submit">Cancel</button>
          </form>
          <p>Cancel is final: this Job can't be Prepared again.</p>
        </>
      )}

      {runs.length > 0 && (
        <p>
          <Link href="/function-runs">Function runs</Link>
        </p>
      )}
    </main>
  );
}
