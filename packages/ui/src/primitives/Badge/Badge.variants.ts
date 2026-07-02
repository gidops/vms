import { tv } from "../../foundations/variants";

export const badgeVariants = tv({
  base: [
    "inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-medium",
  ],
  variants: {
    intent: {
      neutral:
        "[--bdg:var(--color-fg-muted)] [--bdg-subtle:var(--color-surface-muted)]",
      primary:
        "[--bdg:var(--color-primary)] [--bdg-subtle:var(--color-primary-subtle)]",
      accent:
        "[--bdg:var(--color-accent-fg)] [--bdg-subtle:var(--color-accent)]",
      success:
        "[--bdg:var(--color-success)] [--bdg-subtle:var(--color-success-subtle)]",
      warning:
        "[--bdg:var(--color-warning)] [--bdg-subtle:var(--color-warning-subtle)]",
      danger:
        "[--bdg:var(--color-danger)] [--bdg-subtle:var(--color-danger-subtle)]",
      info: "[--bdg:var(--color-info)] [--bdg-subtle:var(--color-info-subtle)]",
      purple:
        "[--bdg:var(--color-purple)] [--bdg-subtle:var(--color-purple-subtle)]",
    },
    tone: {
      soft: "border-transparent bg-[var(--bdg-subtle)] text-[var(--bdg)]",
      solid:
        "border-transparent bg-[var(--bdg)] text-[var(--color-fg-on-emphasis)]",
      outline: "border-[var(--bdg)] bg-transparent text-[var(--bdg)]",
    },
    size: {
      sm: "h-5 px-2 text-xs",
      md: "h-6 px-2.5 text-xs",
      lg: "h-7 px-3 text-sm",
    },
  },
  defaultVariants: { intent: "neutral", tone: "soft", size: "md" },
});
