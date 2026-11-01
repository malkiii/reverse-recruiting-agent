import { revalidatePath } from "next/cache";
import Link from "next/link";
import { connection } from "next/server";
import { drizzleFunctionRunStore } from "@/lib/drizzle";
import { parseDashboardEnv } from "@/lib/env";
import { runAsOf } from "@/lib/function-runs";

async function startNoop() {
  "use server";

  const { FUNCTIONS_BASE_URL, FUNCTIONS_SECRET } = parseDashboardEnv(process.env);
  const response = await fetch(new URL("/functions/noop", FUNCTIONS_BASE_URL), {
    method: "POST",
    headers: { authorization: `Bearer ${FUNCTIONS_SECRET}` },
  });
  if (!response.ok) throw new Error(`The Function was refused: ${response.status}`);
  revalidatePath("/function-runs");
}

export default async function FunctionRunsPage() {
  await connection();
  const { DATABASE_URL } = parseDashboardEnv(process.env);
  const now = new Date();
  const runs = (await drizzleFunctionRunStore(DATABASE_URL).list()).map((run) => runAsOf(run, now));

  return (
    <main>
      {runs.some(({ status }) => status === "running") && <meta httpEquiv="refresh" content="3" />}
      <h1>Function runs</h1>
      <Link href="/jobs">Jobs</Link>
      <form action={startNoop}>
        <button type="submit">Run no-op</button>
      </form>
      {runs.length === 0 ? (
        <p>No Function runs yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Function</th>
              <th>Status</th>
              <th>Started</th>
              <th>Finished</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>{run.functionName}</td>
                <td>{run.status}</td>
                <td>{run.startedAt.toISOString()}</td>
                <td>{run.finishedAt?.toISOString()}</td>
                <td>{run.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
