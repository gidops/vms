import { DetailSection, type DetailSectionProps, cn } from "@vms/ui";

/**
 * A visit-detail sheet section: a collapsible, card-styled DetailSection. Every
 * section in the sheet uses this so they read as one consistent, foldable set.
 */
export function SheetSection({ className, ...props }: DetailSectionProps) {
  return (
    <DetailSection
      collapsible
      defaultOpen
      className={cn(
        "rounded-xl border border-border bg-surface p-4",
        className,
      )}
      {...props}
    />
  );
}
