export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-600 text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400",
  secondary:
    "border border-slate-300 bg-white text-slate-800 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
  danger:
    "border border-red-200 bg-white text-red-700 shadow-xs hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/40",
  ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
};

/** Buttons are at least 44px tall on phones and 36px from the small breakpoint up, so they're easy to tap. */
export function buttonClass(variant: ButtonVariant = "primary", { block = false }: { block?: boolean } = {}) {
  return [
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition select-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60",
    "sm:min-h-9",
    block ? "w-full" : "",
    VARIANTS[variant],
  ].join(" ");
}
