import * as React from "react";
import { cn } from "../../foundations/cn";

export interface TopNavShellProps {
  /** The top navigation bar (typically a <TopNav />). */
  nav: React.ReactNode;
  /**
   * Optional bar pinned beneath the nav for global search/filters. Rendered on
   * a surface background, sticky under the nav.
   */
  filterBar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Top-nav page shell: a fixed-height nav bar, an optional global filter bar,
 * and a scrollable main content area. Used by the dashboard instead of the
 * sidebar-based `AppShell` (which remains available for other layouts).
 */
export function TopNavShell({
  nav,
  filterBar,
  children,
  className,
}: TopNavShellProps) {
  return (
    <div
      className={cn(
        "flex h-screen w-full flex-col bg-canvas text-fg",
        className,
      )}
    >
      {nav}
      {filterBar ? (
        <div className="shrink-0 border-b border-border bg-surface px-4 py-3 sm:px-6">
          {filterBar}
        </div>
      ) : null}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}
