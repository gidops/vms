import { DetailSection, type DetailSectionProps, cn } from "@vms/ui";

/** Collapsible card section used by every part of the visit-detail sheet. */
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
