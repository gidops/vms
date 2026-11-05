import { tv, type VariantProps } from "../../foundations/variants";

/**
 * `default` sits on light surfaces; `onEmphasis` is the translucent field used
 * inside the deep-green `TopNav` (global search).
 */
export const searchInputVariants = tv({
  slots: {
    icon: "pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2",
    input: "ps-9",
    clear:
      "absolute end-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
  },
  variants: {
    variant: {
      default: {
        icon: "text-fg-subtle",
        clear: "text-fg-subtle hover:text-fg",
      },
      onEmphasis: {
        icon: "text-emphasis-muted",
        input:
          "h-10 rounded-lg border-transparent bg-emphasis-fg/10 text-emphasis-fg placeholder:text-emphasis-muted focus:border-[var(--color-accent)]",
        clear: "text-emphasis-muted hover:text-emphasis-fg",
      },
    },
  },
  defaultVariants: { variant: "default" },
});

export type SearchInputVariantProps = VariantProps<typeof searchInputVariants>;
