import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { drizzleFunctionRunStore, findApplicationIdForJob, listJobsWithApplications } from "@/lib/drizzle";
import { startFunction } from "@/lib/dashboard-functions";
import { parseDashboardEnv } from "@/lib/env";
import { isCollectionActive } from "@/lib/job-collection";
import { COLLECT_JOBS, PREPARE_APPLICATION } from "@/lib/schema";

async function startCollection() {
  "use server";

  // 409 means one is already active, which the page shows after this refresh.
  await startFunction(COLLECT_JOBS);
  revalidatePath("/jobs");
}

async function prepareJob(formData: FormData) {
  "use server";

  const jobId = Number(formData.get("jobId"));
  const response = await startFunction(PREPARE_APPLICATION, { jobId });
  // A 409 means the Job already has its one Application, so the Admin is shown that one.
  const applicationId =
    response.status === 202
      ? response.applicationId
      : await findApplicationIdForJob(parseDashboardEnv(process.env).DATABASE_URL, jobId);
  if (applicationId === undefined) throw new Error(`Job ${jobId} couldn't be Prepared`);
  redirect(`/applications/${applicationId}`);
}

export default async function JobsPage() {
  await connection();
  const { DATABASE_URL } = parseDashboardEnv(process.env);
  const [jobs, runs] = await Promise.all([
    listJobsWithApplications(DATABASE_URL),
    drizzleFunctionRunStore(DATABASE_URL).list(),
  ]);
  const running = isCollectionActive(runs, new Date());

  return (
    <main>
      {running && <meta httpEquiv="refresh" content="5" />}
      <h1>Jobs</h1>
      <nav>
        <Link href="/settings">Settings</Link> <Link href="/google">Google</Link> <Link href="/function-runs">Function runs</Link>
      </nav>
      <form action={startCollection}>
        <button type="submit" disabled={running}>
          Run Job Collection
        </button>
      </form>
      {running && <p>A Job Collection is running.</p>}
      {jobs.length === 0 ? (
        <p>No Jobs yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Company</th>
              <th>Location</th>
              <th>Posted</th>
              <th>Source</th>
              <th>Application</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.url}>
                <td>
                  <a href={job.url}>{job.title}</a>
                </td>
                <td>{job.companyLinkedinUrl ? <a href={job.companyLinkedinUrl}>{job.companyName}</a> : job.companyName}</td>
                <td>{job.location}</td>
                <td>{job.postDay}</td>
                <td>{job.source}</td>
                <td>
                  {job.applicationId ? (
                    <Link href={`/applications/${job.applicationId}`}>{job.applicationStatus}</Link>
                  ) : (
                    <form action={prepareJob}>
                      <input type="hidden" name="jobId" value={job.id} />
                      <button type="submit">Prepare</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
