import { AutoRefresh } from "@/components/auto-refresh";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { connection } from "next/server";
import { SubmitButton } from "@/components/submit-button";
import { Card, dateTime, EmptyState, PageHeader } from "@/components/ui";
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

const STATUS_CLASSES = {
  running: "bg-blue-500",
  succeeded: "bg-emerald-500",
  failed: "bg-red-500",
};

export default async function FunctionRunsPage() {
  await connection();
  const { DATABASE_URL, TIMEZONE } = parseDashboardEnv(process.env);
  const now = new Date();
  const runs = (await drizzleFunctionRunStore(DATABASE_URL).list()).map((run) => runAsOf(run, now));

  return (
    <div className="space-y-4">
      {runs.some(({ status }) => status === "running") && <AutoRefresh seconds={3} />}
      <Link
        href="/settings"
        className="inline-flex min-h-9 items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        ‹ Settings
      </Link>
      <PageHeader
        title="Function runs"
        subtitle="The 20 most recent"
        action={
          <form action={startNoop}>
            <SubmitButton variant="secondary" pendingText="Starting…">
              Run no-op
            </SubmitButton>
          </form>
        }
      />
      {runs.length === 0 ? (
        <EmptyState title="No Function runs yet" />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {runs.map((run) => (
              <li key={run.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <span className={`size-2 shrink-0 rounded-full ${STATUS_CLASSES[run.status]}`} aria-hidden="true" />
                    <span className="truncate">{run.functionName}</span>
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{run.status}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {dateTime(run.startedAt, TIMEZONE)}
                  {run.finishedAt && <> → {dateTime(run.finishedAt, TIMEZONE)}</>}
                </p>
                {run.error && (
                  <p className="mt-1 text-xs break-words text-red-700 dark:text-red-300">{run.error}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
