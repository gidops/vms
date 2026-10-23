import * as React from "react";
import { cn } from "../../foundations/cn";
import { contentContainer } from "../../foundations/layout";

export interface TopNavProps extends React.HTMLAttributes<HTMLElement> {
  /** Brand / logo, pinned to the leading edge. */
  brand?: React.ReactNode;
  /** Centered content (e.g. a SegmentedControl for primary views). */
  center?: React.ReactNode;
  /** Trailing content (e.g. notifications + avatar + chevron). */
  end?: React.ReactNode;
}

/**
 * Horizontal application bar on the deep brand-green emphasis surface. Three
 * slots: brand (leading), center, end (trailing). Replaces the sidebar in the
 * VMC top-nav layout.
 */
export function TopNav({
  brand,
  center,
  end,
  className,
  ...props
}: TopNavProps) {
  return (
    <header
      className={cn(
        "flex h-[72px] w-full shrink-0 items-center bg-emphasis text-emphasis-fg",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          contentContainer,
          "flex items-center gap-4 px-4 sm:px-12",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center">{brand}</div>
        {center ? (
          <div className="hidden items-center justify-center md:flex">
            {center}
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          {end}
        </div>
      </div>
    </header>
  );
}
