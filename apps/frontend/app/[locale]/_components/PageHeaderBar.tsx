import { cn } from "@vms/ui";
import type * as React from "react";

/** Header actions sit beside filter pills, so they share the pill's white fill and border, keeping a button's corners. */
export const headerActionButton =
  "border border-border bg-surface text-fg-muted hover:border-primary hover:bg-surface hover:text-primary";

/**
 * Page title row that hangs flush from the shell's filter bar, with an optional
 * tinted slot on the trailing edge for filter pills or actions.
 */
export function PageHeaderBar({
  title,
  actions,
  className,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    // Negative margin cancels the shell's top padding so the row meets the filter bar's border.
    <div
      className={cn(
        "-mt-4 flex flex-wrap items-stretch justify-between overflow-hidden rounded-b-xl border-x border-b border-border bg-surface sm:-mt-6",
        className,
      )}
    >
      <h1 className="flex items-center px-6 py-6 text-3xl font-semibold text-fg">
        {title}
      </h1>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 bg-primary-subtle px-6 py-3">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
