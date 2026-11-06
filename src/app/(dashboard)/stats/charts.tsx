"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { ActivityPoint } from "@/lib/dashboard-stats";

const AXIS = { tickLine: false, axisLine: false, tick: { fill: "var(--muted)", fontSize: 11 } } as const;

const SERIES = [
  { key: "jobs", label: "Jobs found", color: "var(--accent)" },
  { key: "applications", label: "Applications", color: "var(--fg-2)" },
  { key: "emailsSent", label: "Emails sent", color: "#10b981" },
] as const;

/** A day bucket (YYYY-MM-DD) as "Nov 6", an hour bucket (YYYY-MM-DDTHH) as "14:00". */
function bucketLabel(bucket: string) {
  if (bucket.includes("T")) return `${bucket.slice(11)}:00`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${bucket}T00:00:00Z`),
  );
}

function ChartTooltip({ active, payload, label }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-sm border border-line-strong bg-surface px-3 py-2 text-xs shadow-lg shadow-black/20">
      {label !== undefined && <p className="mb-1.5 text-muted">{String(label)}</p>}
      <ul className="space-y-1">
        {payload.map((item) => (
          <li key={String(item.dataKey ?? item.name)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-xs" style={{ background: item.color ?? item.payload?.fill }} />
              {item.name}
            </span>
            <span className="font-mono tabular-nums">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Jobs found, Applications and emails sent over the range, as overlapping soft areas. */
export function ActivityChart({ points }: { points: ActivityPoint[] }) {
  const data = points.map((point) => ({ ...point, label: bucketLabel(point.bucket) }));
  const totals = Object.fromEntries(SERIES.map(({ key }) => [key, points.reduce((sum, point) => sum + point[key], 0)]));

  return (
    <div>
      <ul className="mb-4 flex flex-wrap gap-x-6 gap-y-2">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-2 text-xs text-muted">
            <span className="h-0.5 w-3" style={{ background: series.color }} />
            {series.label}
            <span className="font-mono text-fg tabular-nums">{totals[series.key]}</span>
          </li>
        ))}
      </ul>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              {SERIES.map((series) => (
                <linearGradient key={series.key} id={`fill-${series.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={series.color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={series.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" {...AXIS} minTickGap={24} tickMargin={8} />
            <YAxis {...AXIS} allowDecimals={false} width={44} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--line-strong)" }} />
            {SERIES.map((series) => (
              <Area
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={series.color}
                strokeWidth={1.5}
                fill={`url(#fill-${series.key})`}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** One horizontal bar per row, most first. */
export function BarsChart({ rows, empty }: { rows: { label: string; count: number }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div style={{ height: Math.max(rows.length * 36, 120) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="label" {...AXIS} width={120} tick={{ ...AXIS.tick, fill: "var(--fg-2)" }} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--subtle)" }} />
          <Bar
            dataKey="count"
            name="Jobs"
            fill="var(--accent)"
            radius={[0, 2, 2, 0]}
            label={{ position: "right", fill: "var(--muted)", fontSize: 11 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A donut with the total in the middle and a legend beside it. */
export function DonutChart({
  rows,
  empty,
}: {
  rows: { label: string; count: number; color: string }[];
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  const total = rows.reduce((sum, { count }) => sum + count, 0);
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative size-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<ChartTooltip />} />
            <Pie
              data={rows}
              dataKey="count"
              nameKey="label"
              innerRadius="72%"
              outerRadius="100%"
              paddingAngle={rows.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {rows.map((row) => (
                <Cell key={row.label} fill={row.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-mono text-2xl font-medium tabular-nums">{total}</p>
            <p className="text-[11px] text-muted">total</p>
          </div>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2 shrink-0 rounded-xs" style={{ background: row.color }} />
              <span className="truncate text-fg-2">{row.label}</span>
            </span>
            <span className="font-mono text-xs tabular-nums">
              {row.count}
              <span className="ml-2 text-faint">{Math.round((row.count / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
