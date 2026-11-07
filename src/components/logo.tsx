import { cx } from "./ui";

/** The app's mark: a briefcase on a solid tile. */
export function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center bg-fg text-bg",
        size === "sm" ? "size-6 rounded-xs" : "size-11 rounded-sm",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={size === "sm" ? "size-3.5" : "size-6"}
        aria-hidden="true"
      >
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
      </svg>
    </span>
  );
}
