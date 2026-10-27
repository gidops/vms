import { tv, type VariantProps } from "../../foundations/variants";

/** The active item's emphasis bar uses logical `border-s` so it flips in RTL. */
export const sideNavVariants = tv({
  slots: {
    root: "flex h-full shrink-0 flex-col border-e border-border bg-surface transition-[width]",
    list: "flex flex-1 flex-col overflow-y-auto py-5",
    item: [
      "flex h-11 w-full items-center gap-3 border-s-4 border-transparent px-4 text-sm font-medium text-fg-muted transition-colors outline-none",
      "hover:bg-surface-muted hover:text-fg",
      "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-ring)]",
    ],
    footer: "flex justify-end px-4 py-4",
    toggle: [
      "inline-flex size-8 items-center justify-center rounded-md text-fg-muted transition-colors outline-none",
      "hover:bg-surface-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
    ],
  },
  variants: {
    collapsed: {
      true: {
        root: "w-16",
        item: "justify-center px-0",
        footer: "justify-center px-0",
      },
      false: { root: "w-58" },
    },
    active: {
      true: { item: "border-emphasis bg-surface-muted text-fg" },
    },
    disabled: {
      true: {
        item: "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-fg-muted",
      },
    },
  },
  defaultVariants: { collapsed: false },
});

export type SideNavVariantProps = VariantProps<typeof sideNavVariants>;
