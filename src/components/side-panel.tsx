"use client";

import { usePathname } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { SIDE_PANEL_COOKIE } from "@/lib/ui-cookies";
import { cx } from "./ui";

/** The pages that have a right side panel. */
const PANEL_PAGES = ["/jobs"];

/** From here up the panel sits beside the page; below, it slides over it. Tailwind's xl breakpoint. */
const DOCKED_QUERY = "(min-width: 80rem)";

type SidePanelState = { docked: boolean; drawer: boolean; toggle: () => void; close: () => void };

const SidePanelContext = createContext<SidePanelState | null>(null);

function useSidePanel() {
  const state = useContext(SidePanelContext);
  if (!state) throw new Error("useSidePanel needs a SidePanelProvider");
  return state;
}

/**
 * Whether the right side panel is open. On wide screens it's docked beside the page and stays as the Admin left it
 * (kept in a cookie). On narrower ones it's a drawer that starts closed.
 */
export function SidePanelProvider({ initialOpen, children }: { initialOpen: boolean; children: ReactNode }) {
  const [docked, setDocked] = useState(initialOpen);
  const [drawer, setDrawer] = useState(false);

  const setDockedAndRemember = (open: boolean) => {
    setDocked(open);
    document.cookie = `${SIDE_PANEL_COOKIE}=${open ? "open" : "closed"}; path=/; max-age=31536000; samesite=lax`;
  };
  const isDocked = () => window.matchMedia(DOCKED_QUERY).matches;

  const state: SidePanelState = {
    docked,
    drawer,
    toggle: () => (isDocked() ? setDockedAndRemember(!docked) : setDrawer(!drawer)),
    close: () => (isDocked() ? setDockedAndRemember(false) : setDrawer(false)),
  };
  return <SidePanelContext value={state}>{children}</SidePanelContext>;
}

/** Makes room for the docked panel on the pages that have one. */
export function SidePanelOffset({ className, children }: { className?: string; children: ReactNode }) {
  const { docked } = useSidePanel();
  const hasPanel = PANEL_PAGES.includes(usePathname());
  return <div className={cx(className, hasPanel && docked && "xl:pr-96")}>{children}</div>;
}

export function SidePanelToggle({ label }: { label: string }) {
  const { docked, drawer, toggle } = useSidePanel();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-expanded={drawer || undefined}
      className={cx(
        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-line-strong text-muted transition hover:bg-subtle hover:text-fg sm:min-h-8 sm:min-w-8",
        drawer && "bg-subtle text-fg",
        docked && "xl:bg-subtle xl:text-fg",
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-4" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="1" />
        <path d="M15 4v16" />
      </svg>
    </button>
  );
}

export function SidePanel({ title, children }: { title: string; children: ReactNode }) {
  const { docked, drawer, close } = useSidePanel();

  useEffect(() => {
    if (!drawer) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer, close]);

  return (
    <>
      {drawer && <div aria-hidden="true" onClick={close} className="fixed inset-0 z-40 bg-black/60 xl:hidden" />}
      <aside
        aria-label={title}
        className={cx(
          "fixed inset-y-0 right-0 z-50 w-full max-w-sm flex-col border-l border-line bg-bg xl:z-20 xl:w-96 xl:max-w-none",
          drawer ? "flex" : "hidden",
          docked ? "xl:flex" : "xl:hidden",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
          <h2 className="text-[13px] font-medium">{title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label={`Close ${title}`}
            className="inline-flex size-8 items-center justify-center rounded-sm text-muted transition hover:bg-subtle hover:text-fg"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{children}</div>
      </aside>
    </>
  );
}
