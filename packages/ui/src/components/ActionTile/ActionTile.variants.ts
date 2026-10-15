import { tv, type VariantProps } from "../../foundations/variants";

/**
 * Square-ish quick-action tile: icon above a short label. `intent` follows the
 * Button convention — `primary` is the solid brand tile for the main action,
 * `neutral` the light secondary tile.
 */
export const actionTileVariants = tv({
  base: [
    "flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-colors outline-none",
    "focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
  ],
  variants: {
    intent: {
      primary: "bg-primary text-primary-fg hover:bg-primary-hover",
      neutral:
        "border border-border bg-surface-stripe text-fg hover:bg-surface-muted",
    },
  },
  defaultVariants: { intent: "neutral" },
});

export type ActionTileVariantProps = VariantProps<typeof actionTileVariants>;
