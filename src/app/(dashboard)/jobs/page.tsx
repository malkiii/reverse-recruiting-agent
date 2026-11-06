import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { sourceName } from "@/components/status";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Card, EmptyState, linkClass, PageHeader, percent, shortDate, StatTile, StatusBadge } from "@/components/ui";
import { startFunction } from "@/lib/dashboard-functions";
import { loadStatsRows } from "@/lib/dashboard-data";
import { jobsStrip } from "@/lib/dashboard-stats";
import { drizzleFunctionRunStore, findApplicationIdForJob, listJobsWithApplications } from "@/lib/drizzle";
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

type JobRow = Awaited<ReturnType<typeof listJobsWithApplications>>[number];

function ApplicationCell({ job, block }: { job: JobRow; block?: boolean }) {
  if (job.applicationId && job.applicationStatus) {
    return (
      <Link href={`/applications/${job.applicationId}`} className="inline-flex items-center gap-1 py-1">
        <StatusBadge status={job.applicationStatus} />
        <span aria-hidden="true" className="text-slate-400">
          ›
        </span>
      </Link>
    );
  }
  return (
    <form action={prepareJob}>
      <input type="hidden" name="jobId" value={job.id} />
      <SubmitButton pendingText="Preparing…" block={block}>
        Prepare
      </SubmitButton>
    </form>
  );
}

function CompanyName({ job }: { job: JobRow }) {
  return job.companyLinkedinUrl ? (
    <a href={job.companyLinkedinUrl} className="hover:underline">
      {job.companyName}
    </a>
  ) : (
    <>{job.companyName}</>
  );
}

export default async function JobsPage() {
  await connection();
  const { DATABASE_URL, TIMEZONE } = parseDashboardEnv(process.env);
  const now = new Date();
  const [jobs, runs, statsRows] = await Promise.all([
    listJobsWithApplications(DATABASE_URL),
    drizzleFunctionRunStore(DATABASE_URL).list(),
    loadStatsRows(DATABASE_URL, now),
  ]);
  const running = isCollectionActive(runs, now);
  const strip = jobsStrip(statsRows, now, TIMEZONE);

  return (
    <>
      {running && <meta httpEquiv="refresh" content="5" />}
      <PageHeader
        title="Jobs"
        subtitle={`${jobs.length} most recent`}
        action={
          <form action={startCollection}>
            <SubmitButton variant="secondary" pendingText="Starting…" disabled={running}>
              {running ? "Collecting…" : "Run Job Collection"}
            </SubmitButton>
          </form>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="New Jobs today" value={strip.newJobsToday} />
        <StatTile label="In Review" value={strip.inReview} href="/applications?status=in-review" />
        <StatTile label="Sent this week" value={strip.sentThisWeek} />
        <StatTile label="Email-Found Rate" value={percent(strip.emailFoundRate)} href="/stats" />
      </div>

      {running && (
        <div className="mb-4">
          <Alert tone="info">A Job Collection is running. This page refreshes until it&apos;s done.</Alert>
        </div>
      )}

      {jobs.length === 0 ? (
        <EmptyState title="No Jobs yet">
          Run a Job Collection, or turn on a Job Board or Job Feed in{" "}
          <Link href="/settings" className={linkClass}>
            Settings
          </Link>
          .
        </EmptyState>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {jobs.map((job) => (
              <li key={job.url}>
                <Card className="p-4">
                  <a href={job.url} className="block text-base leading-snug font-semibold">
                    {job.title}
                  </a>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    <CompanyName job={job} />
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {job.location} · {shortDate(job.postDay, TIMEZONE)} · {sourceName(job.source)}
                  </p>
                  <div className="mt-3">
                    <ApplicationCell job={job} block />
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          <Card className="hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Job</th>
                  <th className="px-4 py-2.5 font-medium">Location</th>
                  <th className="px-4 py-2.5 font-medium">Posted</th>
                  <th className="px-4 py-2.5 font-medium">Source</th>
                  <th className="px-4 py-2.5 text-right font-medium">Application</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {jobs.map((job) => (
                  <tr key={job.url} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="max-w-80 px-4 py-3">
                      <a href={job.url} className="font-medium hover:underline">
                        {job.title}
                      </a>
                      <div className="text-slate-500 dark:text-slate-400">
                        <CompanyName job={job} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{job.location}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {shortDate(job.postDay, TIMEZONE)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{sourceName(job.source)}</td>
                    <td className="px-4 py-3 text-right">
                      <ApplicationCell job={job} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
