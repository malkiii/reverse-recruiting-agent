import { AutoRefresh } from "@/components/auto-refresh";
import Link from "next/link";
import { connection } from "next/server";
import { FILTER_LABELS, STEP_NAMES } from "@/components/status";
import { Card, EmptyState, linkClass, PageHeader, Segmented, shortDate, StatusBadge } from "@/components/ui";
import { loadApplications } from "@/lib/dashboard-data";
import { groupCounts, parseStatusFilter, STATUS_GROUPS, statusGroup } from "@/lib/dashboard-stats";
import { parseDashboardEnv } from "@/lib/env";

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await connection();
  const filter = parseStatusFilter((await searchParams).status);
  const { DATABASE_URL, TIMEZONE } = parseDashboardEnv(process.env);
  const all = await loadApplications(DATABASE_URL, new Date());
  const counts = groupCounts(all.map(({ application }) => application.status));
  const shown = filter === "all" ? all : all.filter(({ application }) => statusGroup(application.status) === filter);
  const working = all.some(({ application }) => statusGroup(application.status) === "working");

  return (
    <>
      {working && <AutoRefresh seconds={5} />}
      <PageHeader title="Applications" subtitle="Everything you've Prepared, newest first" />

      <Segmented
        label="Filter by status"
        options={(["all", ...STATUS_GROUPS] as const).map((group) => ({
          href: group === "all" ? "/applications" : `/applications?status=${group}`,
          active: filter === group,
          label: (
            <>
              {FILTER_LABELS[group]}
              <span className="tabular-nums opacity-70">{counts[group]}</span>
            </>
          ),
        }))}
      />

      {shown.length === 0 ? (
        <EmptyState title={filter === "all" ? "No Applications yet" : `No ${FILTER_LABELS[filter]} Applications`}>
          {filter === "all" ? (
            <>
              Prepare a Job from{" "}
              <Link href="/jobs" className={linkClass}>
                Jobs
              </Link>{" "}
              to start one.
            </>
          ) : (
            <Link href="/applications" className={linkClass}>
              Show all
            </Link>
          )}
        </EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {shown.map(({ application, jobTitle, companyName }) => (
              <li key={application.id}>
                <Link
                  href={`/applications/${application.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/40 dark:active:bg-slate-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{jobTitle}</p>
                    <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                      {companyName}
                      {statusGroup(application.status) === "working" && <> · {STEP_NAMES[application.currentStep]}…</>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge status={application.status} />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {shortDate(application.createdAt, TIMEZONE)}
                    </span>
                  </div>
                  <span aria-hidden="true" className="text-slate-400">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
