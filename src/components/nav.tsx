"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const icon = (path: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-6 md:size-5"
    aria-hidden="true"
  >
    {path}
  </svg>
);

const TABS = [
  {
    href: "/jobs",
    label: "Jobs",
    icon: icon(
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
      </>,
    ),
  },
  {
    href: "/applications",
    label: "Applications",
    icon: icon(
      <>
        <path d="M4 6l8 6 8-6" />
        <rect x="3" y="5" width="18" height="14" rx="2" />
      </>,
    ),
  },
  {
    href: "/stats",
    label: "Stats",
    icon: icon(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: icon(
      <>
        <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>,
    ),
  },
];

/** Google and Function runs live under Settings. */
const SECTION_OF: Record<string, string> = { "/google": "/settings", "/function-runs": "/settings" };

function activeTab(pathname: string) {
  const section = `/${pathname.split("/")[1]}`;
  return SECTION_OF[section] ?? section;
}

/** A left sidebar on desktop and a bottom tab bar on phones. */
export function Nav() {
  const active = activeTab(usePathname());

  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white px-3 py-5 dark:border-slate-800 dark:bg-slate-900 md:flex">
        <Link href="/jobs" className="mb-6 flex items-center gap-2 px-3">
          <span className="grid size-7 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">R</span>
          <span className="text-sm font-semibold">Reverse Recruiting</span>
        </Link>
        <nav aria-label="Main">
          <ul className="space-y-1">
            {TABS.map((tab) => (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active === tab.href ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active === tab.href
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 md:hidden"
      >
        <ul className="grid h-16 grid-cols-4">
          {TABS.map((tab) => (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active === tab.href ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition active:scale-95 ${
                  active === tab.href ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {tab.icon}
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
