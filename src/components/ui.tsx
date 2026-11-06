import Link from "next/link";
import type { ReactNode } from "react";
import type { ApplicationStatus } from "@/lib/gateways";
import { STATUS_LABELS, statusTone } from "./status";

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

export const linkClass = "font-medium text-indigo-600 hover:underline dark:text-indigo-400";

export const inputClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-xs outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:text-sm";

export const labelClass = "mb-1.5 block text-sm font-medium";

export const checkboxClass = "size-5 rounded border-slate-300 accent-indigo-600 dark:border-slate-600";

export const percent = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate * 100)}%`);

/** A calendar day such as a post day (YYYY-MM-DD), or the day a moment falls on in the timezone. */
export const shortDate = (date: Date | string, timeZone: string) =>
  typeof date === "string"
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`))
    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone }).format(date);

export const dateTime = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone }).format(date);

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cx(
        "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 md:rounded-xl",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
      <h2 className="text-sm font-semibold">{title}</h2>
      {action}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("px-4 py-4", className)}>{children}</div>;
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        statusTone(status).badge,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Tag({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "amber" | "emerald" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    amber: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  };
  return (
    <span className={cx("inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function Alert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "warning" | "info" }) {
  const tones = {
    error: "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200",
    warning:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
    info: "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200",
  };
  return (
    <div
      role={tone === "info" ? "status" : "alert"}
      className={cx("rounded-xl border px-4 py-3 text-sm break-words", tones[tone])}
    >
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{children}</div>}
    </div>
  );
}

export function StatTile({ label, value, href }: { label: string; value: ReactNode; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
    </>
  );
  const className =
    "block rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 md:rounded-xl";
  return href ? (
    <Link
      href={href}
      className={cx(className, "transition hover:border-indigo-300 active:scale-[0.98] dark:hover:border-indigo-700")}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Label and value rows, such as a Company's details. */
export function DetailList({ items }: { items: [label: string, value: ReactNode][] }) {
  return (
    <dl className="divide-y divide-slate-200 dark:divide-slate-800">
      {items.map(([label, value]) => (
        <div key={label} className="grid grid-cols-3 gap-3 px-4 py-3 text-sm">
          <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
          <dd className="col-span-2 min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A horizontal row of options, each a link, such as status filters or stats ranges. */
export function Segmented({
  options,
  label,
}: {
  label: string;
  options: { href: string; label: ReactNode; active: boolean }[];
}) {
  return (
    <nav aria-label={label} className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
      <ul className="flex w-max gap-2">
        {options.map((option) => (
          <li key={option.href}>
            <Link
              href={option.href}
              replace
              scroll={false}
              aria-current={option.active ? "page" : undefined}
              className={cx(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition active:scale-95",
                option.active
                  ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
              )}
            >
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
