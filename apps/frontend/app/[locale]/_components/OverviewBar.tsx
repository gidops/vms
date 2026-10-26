"use client";

import { cn } from "@vms/ui";
import { ChevronDown } from "lucide-react";
import * as React from "react";

export interface OverviewStat {
  label: string;
  value: React.ReactNode;
  /** Optional one-line context under the value (e.g. "2 waiting over 1 hour"). */
  hint?: React.ReactNode;
  /**
   * `warning` paints the cell as the bar's hero: warm background with the
   * label and value in the warning colour (the admin "Awaiting approval").
   */
  tone?: "default" | "warning";
}

export interface OverviewBarProps {
  /** Heading row content (eyebrow + welcome `<h1>`). */
  heading: React.ReactNode;
  /**
   * Optional trailing cell of the heading row, above the action panel (the
   * staff office floor). On mobile it stacks under the heading.
   */
  aside?: React.ReactNode;
  /** Exactly three stat cells on desktop. */
  stats: OverviewStat[];
  /** Brand-green action panel content (title + buttons). */
  panel: React.ReactNode;
  /**
   * `alert` gives the action panel a muted red tint (brand green blended with
   * danger) as a quiet signal, e.g. people on the Evacuation Roll.
   */
  panelTone?: "default" | "alert";
  /**
   * How the stats render below `lg`: `collapsible` (VMC "View your activity")
   * or a plain `grid` (staff, admin).
   */
  mobileStats?: "collapsible" | "grid";
  /** Toggle label for the collapsible mobile stats. */
  collapsibleLabel?: string;
}

/**
 * Decorative nested chevrons bleeding off the top-right corner of the green
 * panel — a subtle brand watermark matching the Figma design.
 *
 * The SVG fills the panel and uses a `0 0 449 149` viewBox (the design panel's
 * own coordinate space) with `xMaxYMin slice`, so the chevrons stay pinned to
 * the top-right corner and scale with the panel at any width/height. The paths
 * are drawn at the exact design coordinates and intentionally extend past the
 * viewBox (negative Y / x > 449) so they bleed off the top and right edges,
 * clipped by the panel's `overflow-hidden`.
 */
export function DecorChevrons() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 449 149"
      preserveAspectRatio="xMaxYMin slice"
      className="pointer-events-none absolute inset-0 h-full w-full text-emphasis-fg/[0.07] rtl:-scale-x-100"
      fill="none"
      stroke="currentColor"
      strokeWidth="17"
      strokeLinejoin="round"
    >
      <path d="M287 -15 L387 65 L487 -15" />
      <path d="M287 -52 L387 28 L487 -52" />
      <path d="M287 -89 L387 -9 L487 -89" />
    </svg>
  );
}

export function StatCell({ stat }: { stat: OverviewStat }) {
  const warning = stat.tone === "warning";
  return (
    <div className="flex flex-col gap-3 px-8 py-6" data-tone={stat.tone ?? "default"}>
      <span
        className={cn(
          "text-xl leading-6 font-normal",
          warning ? "text-warning" : "text-[#526070]",
        )}
      >
        {stat.label}
      </span>
      <span
        className={cn(
          "text-[2.5rem] font-[550] leading-[1.2]",
          warning ? "text-warning" : "text-[#344054]",
        )}
      >
        {stat.value}
      </span>
      {stat.hint ? (
        <span className="text-sm text-fg-muted">{stat.hint}</span>
      ) : null}
    </div>
  );
}

/** Background for a stat cell: the warning hero gets the warm tint. */
export const cellBg = (stat: OverviewStat) =>
  stat.tone === "warning" ? "bg-warning-subtle" : "bg-primary-subtle";

/** Colour of the vertical lines between stat cells (on every stats bar; 2px wide). */
export const STAT_SEPARATOR = "border-s-[#A9B5C0]";

/**
 * Borders for cell `i` of a wrapping 2-up (sm) / 4-up (xl) stat grid, as on
 * Insights: a horizontal rule between rows, and the separator line only where a
 * cell has a neighbour to its end side (never doubled against the outer border).
 */
export const statGridCellClass = (i: number) =>
  cn(
    "border-b border-border last:border-b-0 xl:border-b-0",
    "border-e-[#A9B5C0]",
    i % 2 === 0 ? "sm:border-e-[2px]" : "sm:border-e-0",
    i % 4 === 3 ? "xl:border-e-0" : "xl:border-e-[2px]",
  );

/** Muted red tint for an action panel: brand green blended with danger. */
export const PANEL_ALERT_CLASS =
  "bg-[color-mix(in_oklab,var(--color-danger)_40%,var(--color-emphasis))]";

function Panel({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "alert";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col justify-between gap-4 overflow-hidden bg-emphasis px-6 py-4 text-emphasis-fg transition-colors duration-500",
        tone === "alert" && PANEL_ALERT_CLASS,
        className,
      )}
    >
      <DecorChevrons />
      {children}
    </div>
  );
}

/**
 * The overview bar shared by the VMC desk, the staff schedule and the admin
 * console, rendered as one unified bar:
 *   row 1 — heading (spans the stat columns, or all four without an aside) | aside
 *   row 2 — three stat cells | brand-green action panel
 * Mobile: heading (+ aside), the action panel, then the stats.
 */
export function OverviewBar({
  heading,
  aside,
  stats,
  panel,
  panelTone,
  mobileStats = "grid",
  collapsibleLabel,
}: OverviewBarProps) {
  const [open, setOpen] = React.useState(true);

  return (
    <>
      {/* ── Desktop: heading + stats/panel in one bar ─────────────────────── */}
      <div
        data-testid="overview-bar-desktop"
        className="hidden overflow-hidden rounded-t-xl border border-border shadow-xs lg:grid lg:grid-cols-[repeat(3,1fr)_minmax(300px,1.5fr)]"
      >
        {/* Row 1 */}
        <div
          className={cn(
            "flex items-center bg-surface p-6",
            aside ? "col-span-3" : "col-span-4",
          )}
        >
          {heading}
        </div>
        {aside ? (
          <div className="flex flex-col justify-center border-s border-border bg-surface-muted px-6 py-5">
            {aside}
          </div>
        ) : null}

        {/* Row 2 */}
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={cn(
              "border-t border-border",
              cellBg(stat),
              i > 0 && ["border-s-[2px]", STAT_SEPARATOR],
            )}
          >
            <StatCell stat={stat} />
          </div>
        ))}
        <Panel tone={panelTone} className="border-s border-t border-border">
          {panel}
        </Panel>
      </div>

      {/* ── Mobile: heading, panel, then stats ────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:hidden">
        <div className="flex flex-col gap-1">
          {heading}
          {aside}
        </div>
        <Panel tone={panelTone} className="rounded-xl">
          {panel}
        </Panel>

        {mobileStats === "collapsible" ? (
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-2 p-4 text-start"
            >
              <span className="text-lg font-semibold text-fg-muted">
                {collapsibleLabel}
              </span>
              <ChevronDown
                className={cn(
                  "size-5 shrink-0 text-fg-muted transition-transform",
                  open && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
            {open ? (
              <div className="divide-y divide-border border-t border-border">
                {stats.map((stat) => (
                  <div key={stat.label} className={cellBg(stat)}>
                    <StatCell stat={stat} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border shadow-xs sm:grid-cols-3 sm:divide-x-[2px] sm:divide-y-0 sm:divide-[#A9B5C0] rtl:sm:divide-x-reverse">
            {stats.map((stat) => (
              <div key={stat.label} className={cellBg(stat)}>
                <StatCell stat={stat} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
