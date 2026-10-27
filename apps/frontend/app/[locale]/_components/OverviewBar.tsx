"use client";

import { cn } from "@vms/ui";
import { ChevronDown, ChevronRight } from "lucide-react";
import * as React from "react";
import { Link } from "@/i18n/navigation";

export interface OverviewStat {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "warning";
  link?: { href: string; label: string };
}

export interface OverviewBarProps {
  heading: React.ReactNode;
  /** Trailing heading-row cell; stacks under the heading on mobile. */
  aside?: React.ReactNode;
  /** Exactly three stat cells on desktop. */
  stats: OverviewStat[];
  panel: React.ReactNode;
  panelTone?: "default" | "alert";
  mobileStats?: "collapsible" | "grid";
  collapsibleLabel?: string;
}

/** Decorative watermark; the paths deliberately overflow the viewBox so they bleed off the panel's clipped edges. */
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
    <div
      className="flex flex-col gap-3 px-8 py-6"
      data-tone={stat.tone ?? "default"}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-xl leading-6 font-normal",
            warning ? "text-warning" : "text-[#526070]",
          )}
        >
          {stat.label}
        </span>
        {stat.link ? (
          <Link
            href={stat.link.href}
            aria-label={stat.link.label}
            title={stat.link.label}
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
              warning
                ? "text-warning hover:bg-warning/10"
                : "text-[#526070] hover:bg-primary/10",
            )}
          >
            <ChevronRight
              className="size-5 rtl:rotate-180"
              aria-hidden="true"
            />
          </Link>
        ) : null}
      </div>
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

export const cellBg = (stat: OverviewStat) =>
  stat.tone === "warning" ? "bg-warning-subtle" : "bg-primary-subtle";

export const STAT_SEPARATOR = "border-s-[#A9B5C0]";

/** Borders for cell `i` of a 2-up (sm) / 4-up (xl) grid; the end separator appears only where a neighbour follows. */
export const statGridCellClass = (i: number) =>
  cn(
    "border-b border-border last:border-b-0 xl:border-b-0",
    "border-e-[#A9B5C0]",
    i % 2 === 0 ? "sm:border-e-[2px]" : "sm:border-e-0",
    i % 4 === 3 ? "xl:border-e-0" : "xl:border-e-[2px]",
  );

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

/** Heading row above three stat cells and the action panel; stacks vertically on mobile. */
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
      <div
        data-testid="overview-bar-desktop"
        className="hidden overflow-hidden rounded-t-xl border border-border shadow-xs lg:grid lg:grid-cols-[repeat(3,1fr)_minmax(300px,1.5fr)]"
      >
        <div
          className={cn(
            "flex items-center bg-surface px-6 py-3",
            aside ? "col-span-3" : "col-span-4",
          )}
        >
          {heading}
        </div>
        {aside ? (
          <div className="flex flex-col justify-center border-s border-border bg-surface-muted px-6 py-3">
            {aside}
          </div>
        ) : null}

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
