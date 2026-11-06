export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-fg text-bg hover:opacity-85 focus-visible:outline-accent",
  secondary: "border border-line-strong bg-surface text-fg hover:bg-subtle focus-visible:outline-accent",
  danger:
    "border border-red-500/30 bg-surface text-red-600 hover:bg-red-500/10 focus-visible:outline-red-500 dark:text-red-400",
  ghost: "text-fg-2 hover:bg-subtle hover:text-fg focus-visible:outline-accent",
};

/** Buttons are at least 44px tall on phones and 32px from the small breakpoint up, so they're easy to tap. */
export function buttonClass(variant: ButtonVariant = "primary", { block = false }: { block?: boolean } = {}) {
  return [
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-3.5 text-[13px] font-medium transition select-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    "sm:min-h-8",
    block ? "w-full" : "",
    VARIANTS[variant],
  ].join(" ");
}
