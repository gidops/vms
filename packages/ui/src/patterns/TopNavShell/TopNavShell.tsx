import * as React from "react";
import { cn } from "../../foundations/cn";
import { contentContainer } from "../../foundations/layout";

export interface TopNavShellProps {
  /** The top navigation bar (typically a <TopNav />). */
  nav: React.ReactNode;
  /**
   * Optional bar pinned beneath the nav for global search/filters. Rendered on
   * a surface background, sticky under the nav.
   */
  filterBar?: React.ReactNode;
  /**
   * Optional section nav (typically a <SideNav />) on the leading edge, under
   * the top nav. When set, the content area fills the remaining width instead
   * of the centered max-width container (console layout). Hidden below `md`.
   */
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Top-nav page shell: a fixed-height nav bar, an optional global filter bar,
 * an optional section sidebar, and a scrollable main content area. Used by the
 * dashboards instead of the sidebar-based `AppShell` (which remains available
 * for other layouts).
 */
export function TopNavShell({
  nav,
  filterBar,
  sidebar,
  children,
  className,
}: TopNavShellProps) {
  const main = (
    // `relative` makes main the containing block for absolutely positioned
    // descendants (e.g. `sr-only` text) so they scroll with it instead of
    // extending the document.
    <main className="relative flex-1 overflow-y-auto">
      <div
        className={
          sidebar ? "p-4 sm:p-6" : cn(contentContainer, "p-4 sm:px-12 sm:py-6")
        }
      >
        {children}
      </div>
    </main>
  );

  return (
    <div
      className={cn(
        "flex h-screen w-full flex-col bg-canvas text-fg",
        className,
      )}
    >
      {nav}
      {filterBar ? (
        <div className="shrink-0 border-b border-border bg-surface">
          <div className={cn(contentContainer, "px-4 py-[19px] sm:px-12")}>
            {filterBar}
          </div>
        </div>
      ) : null}
      {sidebar ? (
        <div className="flex min-h-0 flex-1">
          <div className="hidden md:flex">{sidebar}</div>
          {main}
        </div>
      ) : (
        main
      )}
    </div>
  );
}
