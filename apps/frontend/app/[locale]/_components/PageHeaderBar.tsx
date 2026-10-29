import { cn } from "@vms/ui";
import type * as React from "react";

/** Header actions sit beside filter pills, so they share the pill's white fill and border, keeping a button's corners. */
export const headerActionButton =
  "border border-border bg-surface text-fg-muted hover:border-primary hover:bg-surface hover:text-primary";

/**
 * Page title row that hangs flush from the shell's filter bar, with an optional
 * tinted slot for filter pills or actions: trailing from md up, beneath the
 * title on small screens.
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
    // Negative margins cancel the shell's padding: flush with the filter bar's
    // border always, and edge to edge (no side borders or corners) on small screens.
    <div
      className={cn(
        "-mx-4 -mt-4 flex flex-col overflow-hidden border-b border-border bg-surface sm:-mx-12 sm:-mt-6 md:mx-0 md:flex-row md:flex-wrap md:items-stretch md:justify-between md:rounded-b-xl md:border-x",
        className,
      )}
    >
      <h1 className="flex items-center px-6 py-4 text-2xl font-semibold text-fg md:py-6 md:text-3xl">
        {title}
      </h1>
      {actions ? (
        // A full-width strip under the title on small screens, its pills held to
        // one row (`*:` reaches the pill group's own wrap) that scrolls sideways.
        <div className="flex items-center gap-2 overflow-x-auto border-t border-border bg-primary-subtle px-6 py-6 *:flex-nowrap md:flex-wrap md:overflow-visible md:border-t-0 md:py-3 md:*:flex-wrap">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
