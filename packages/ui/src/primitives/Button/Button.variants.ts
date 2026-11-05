import { tv } from "../../foundations/variants";

/** Each `intent` sets --btn vars from semantic tokens that every `tone` renders with, so theming flows through. */
export const buttonVariants = tv({
  base: [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-md font-medium select-none cursor-pointer",
    "transition-[color,background-color,opacity,box-shadow] outline-none",
    "focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)]",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  variants: {
    intent: {
      primary:
        "[--btn:var(--color-primary)] [--btn-fg:var(--color-primary-fg)] [--btn-subtle:var(--color-primary-subtle)]",
      accent:
        "[--btn:var(--color-accent)] [--btn-fg:var(--color-accent-fg)] [--btn-subtle:var(--color-accent-subtle)]",
      neutral:
        "[--btn:var(--color-fg)] [--btn-fg:var(--color-surface)] [--btn-subtle:var(--color-surface-muted)]",
      success:
        "[--btn:var(--color-success)] [--btn-fg:var(--color-success-fg)] [--btn-subtle:var(--color-success-subtle)]",
      warning:
        "[--btn:var(--color-warning)] [--btn-fg:var(--color-warning-fg)] [--btn-subtle:var(--color-warning-subtle)]",
      danger:
        "[--btn:var(--color-danger)] [--btn-fg:var(--color-danger-fg)] [--btn-subtle:var(--color-danger-subtle)]",
    },
    tone: {
      solid: "bg-[var(--btn)] text-[var(--btn-fg)] hover:opacity-90",
      soft: "bg-[var(--btn-subtle)] text-[var(--btn)] hover:brightness-95",
      outline:
        "border border-[var(--btn)] text-[var(--btn)] bg-transparent hover:bg-[var(--btn-subtle)]",
      ghost: "text-[var(--btn)] bg-transparent hover:bg-[var(--btn-subtle)]",
    },
    size: {
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-4 text-sm",
      lg: "h-11 px-5 text-base",
    },
    fullWidth: {
      true: "w-full",
    },
  },
  compoundVariants: [
    {
      // Neutral + outline is the app's secondary button: light fill, soft gray border.
      intent: "neutral",
      tone: "outline",
      class:
        "border-[var(--color-btn-secondary-border)] bg-[var(--color-btn-secondary-bg)]",
    },
  ],
  defaultVariants: {
    intent: "primary",
    tone: "solid",
    size: "md",
  },
});
