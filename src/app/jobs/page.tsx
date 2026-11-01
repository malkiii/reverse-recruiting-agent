import { revalidatePath } from "next/cache";
import Link from "next/link";
import { connection } from "next/server";
import { drizzleFunctionRunStore, drizzleJobStore } from "@/lib/drizzle";
import { parseDashboardEnv } from "@/lib/env";
import { isCollectionActive } from "@/lib/job-collection";
import { COLLECT_JOBS } from "@/lib/schema";

async function startCollection() {
  "use server";

  const { FUNCTIONS_BASE_URL, FUNCTIONS_SECRET } = parseDashboardEnv(process.env);
  const response = await fetch(new URL(`/functions/${COLLECT_JOBS}`, FUNCTIONS_BASE_URL), {
    method: "POST",
    headers: { authorization: `Bearer ${FUNCTIONS_SECRET}` },
  });
  // 409 means one is already active, which the page shows after this refresh.
  if (!response.ok && response.status !== 409) throw new Error(`The Function was refused: ${response.status}`);
  revalidatePath("/jobs");
}

export default async function JobsPage() {
  await connection();
  const { DATABASE_URL } = parseDashboardEnv(process.env);
  const [jobs, runs] = await Promise.all([
    drizzleJobStore(DATABASE_URL).list(),
    drizzleFunctionRunStore(DATABASE_URL).list(),
  ]);
  const running = isCollectionActive(runs, new Date());

  return (
    <main>
      {running && <meta httpEquiv="refresh" content="5" />}
      <h1>Jobs</h1>
      <nav>
        <Link href="/settings">Settings</Link> <Link href="/function-runs">Function runs</Link>
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
