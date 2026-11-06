"use client";

import { useState } from "react";
import { THEME_COOKIE } from "@/lib/ui-cookies";

/** Switches between the dark theme (the default) and the light one, and remembers the choice in a cookie. */
export function ThemeToggle({ initialDark, className = "" }: { initialDark: boolean; className?: string }) {
  const [dark, setDark] = useState(initialDark);

  return (
    <button
      type="button"
      onClick={() => {
        const next = !dark;
        document.documentElement.classList.toggle("dark", next);
        document.cookie = `${THEME_COOKIE}=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
        setDark(next);
      }}
      aria-label="Switch between dark and light theme"
      className={`inline-flex size-8 items-center justify-center rounded-sm text-muted transition hover:bg-subtle hover:text-fg ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-4" aria-hidden="true">
        {dark ? (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
      </svg>
    </button>
  );
}
