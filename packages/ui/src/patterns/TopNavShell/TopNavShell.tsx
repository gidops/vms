import * as React from "react";
import { cn } from "../../foundations/cn";
import { contentContainer } from "../../foundations/layout";

export interface TopNavShellProps {
  nav: React.ReactNode;
  /** Sticky bar beneath the nav for global search/filters. */
  filterBar?: React.ReactNode;
  /** Leading-edge section nav; the content then fills the remaining width. Hidden below `md`. */
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function TopNavShell({
  nav,
  filterBar,
  sidebar,
  children,
  className,
}: TopNavShellProps) {
  const main = (
    // `relative` keeps absolutely positioned descendants (e.g. `sr-only`) scrolling with main.
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
      className={cn("flex h-dvh w-full flex-col bg-canvas text-fg", className)}
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
