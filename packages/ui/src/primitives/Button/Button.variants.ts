import { tv } from "../../foundations/variants";

/**
 * Each `intent` sets three CSS custom properties (--btn, --btn-fg, --btn-subtle)
 * from SEMANTIC tokens; each `tone` then renders using those vars. This keeps
 * the variant matrix to intent + tone (not intent × tone compounds) and means
 * dark mode / rebrands flow through automatically via the token layer.
 */
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
  defaultVariants: {
    intent: "primary",
    tone: "solid",
    size: "md",
  },
});
