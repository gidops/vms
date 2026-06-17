import * as React from "react";
import { cn } from "../../foundations/cn";

export interface QuickActionsPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  /** Optional brand mark rendered above the title. */
  logo?: React.ReactNode;
  /** Action buttons (e.g. Register Walk-In, New Invite Request). */
  children: React.ReactNode;
}

/**
 * Deep brand-green promo panel housing the primary quick actions. Sits beside
 * the stat strip on the dashboard. The chevron motif in the trailing corner is
 * decorative (drawn inline so no raster asset ships).
 */
export function QuickActionsPanel({
  title,
  logo,
  children,
  className,
  ...props
}: QuickActionsPanelProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col justify-between gap-6 overflow-hidden rounded-xl bg-emphasis p-5 text-emphasis-fg",
        className,
      )}
      {...props}
    >
      {/* Decorative stacked chevrons, trailing-top corner. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 120 120"
        className="pointer-events-none absolute -top-2 end-0 h-32 w-32 text-emphasis-fg/10 rtl:-scale-x-100"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
      >
        <path d="M20 20 L60 50 L100 20" />
        <path d="M20 50 L60 80 L100 50" />
        <path d="M20 80 L60 110 L100 80" />
      </svg>

      <div className="relative flex flex-col gap-3">
        {logo}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="relative flex flex-wrap items-center gap-3">
        {children}
      </div>
    </div>
  );
}
