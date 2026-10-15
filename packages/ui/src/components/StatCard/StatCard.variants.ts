import { tv, type VariantProps } from "../../foundations/variants";

/**
 * StatCard layout + icon tint.
 *
 * `layout`:
 *   - `inline`  — label/value on the leading side, icon chip trailing (default;
 *                 the original compact card).
 *   - `stacked` — icon chip on top, then label, value and hint (admin overview).
 *
 * `tone` tints the icon chip from semantic tokens, so each metric can carry its
 * own colour (success for expected, warning for pending, …) and still follow
 * dark mode.
 */
export const statCardVariants = tv({
  slots: {
    root: "p-5",
    body: "flex gap-3",
    text: "flex flex-col gap-1",
    label: "text-sm text-fg-muted",
    value: "text-3xl font-semibold text-fg",
    icon: "flex size-10 shrink-0 items-center justify-center rounded-lg",
  },
  variants: {
    layout: {
      inline: {
        body: "items-start justify-between",
      },
      stacked: {
        root: "rounded-2xl",
        body: "flex-col",
        text: "gap-0.5",
        label: "pt-3 text-xs",
        value: "text-[2rem] leading-tight font-bold",
      },
    },
    tone: {
      primary: { icon: "bg-primary-subtle text-primary" },
      success: { icon: "bg-success-subtle text-fg-muted" },
      warning: { icon: "bg-warning-subtle text-fg-muted" },
      info: { icon: "bg-info-subtle text-fg-muted" },
      neutral: { icon: "bg-surface-muted text-fg-muted" },
    },
  },
  defaultVariants: { layout: "inline", tone: "primary" },
});

export type StatCardVariantProps = VariantProps<typeof statCardVariants>;
