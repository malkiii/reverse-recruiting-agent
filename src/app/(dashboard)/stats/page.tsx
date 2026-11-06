import { connection } from "next/server";
import { sourceName, STATUS_LABELS, statusTone } from "@/components/status";
import { Card, CardBody, CardHeader, cx, PageHeader, percent, Segmented, StatTile } from "@/components/ui";
import { loadStatsRows } from "@/lib/dashboard-data";
import { parseRange, stats, STATS_RANGES, type StatsRange } from "@/lib/dashboard-stats";
import { parseDashboardEnv } from "@/lib/env";

const RANGE_LABELS: Record<StatsRange, string> = { "24h": "24h", "7d": "7d", "30d": "30d", all: "All" };
const RANGE_PHRASES: Record<StatsRange, string> = {
  "24h": "in the last 24 hours",
  "7d": "in the last 7 days",
  "30d": "in the last 30 days",
  all: "since the start",
};

/** One labelled horizontal bar per row, scaled to the largest. */
function Bars({ rows, empty }: { rows: { label: string; count: number; color: string }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">{empty}</p>;
  const max = Math.max(...rows.map(({ count }) => count));
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{row.label}</span>
            <span className="font-medium tabular-nums">{row.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className={cx("h-full rounded-full", row.color)} style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await connection();
  const range = parseRange((await searchParams).range);
  const { DATABASE_URL } = parseDashboardEnv(process.env);
  const result = stats(await loadStatsRows(DATABASE_URL, new Date()), range, new Date());
  const totalJobs = result.jobsPerSource.reduce((sum, { count }) => sum + count, 0);
  const totalApplications = result.applicationsByStatus.reduce((sum, { count }) => sum + count, 0);

  return (
    <>
      <PageHeader title="Stats" subtitle={`Activity ${RANGE_PHRASES[range]}`} />

      <Segmented
        label="Time range"
        options={STATS_RANGES.map((option) => ({
          href: option === "30d" ? "/stats" : `/stats?range=${option}`,
          active: option === range,
          label: RANGE_LABELS[option],
        }))}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Jobs found" value={totalJobs} />
        <StatTile label="Applications" value={totalApplications} />
        <StatTile label="Emails sent" value={result.emailsSent} />
        <StatTile label="Email-Found Rate" value={percent(result.emailFoundRate)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Jobs per source" />
          <CardBody>
            <Bars
              empty="No Jobs found in this range."
              rows={result.jobsPerSource.map(({ source, count }) => ({
                label: sourceName(source),
                count,
                color: "bg-indigo-500",
              }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Applications by status" />
          <CardBody>
            <Bars
              empty="No Applications in this range."
              rows={result.applicationsByStatus.map(({ status, count }) => ({
                label: STATUS_LABELS[status],
                count,
                color: statusTone(status).bar,
              }))}
            />
          </CardBody>
        </Card>
      </div>

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        Email-Found Rate: of the Applications that got past the search for Decision Makers, the share that reached at
        least one with an email address.
      </p>
    </>
  );
}
