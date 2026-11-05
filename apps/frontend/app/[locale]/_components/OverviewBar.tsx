"use client";

import { cn } from "@vms/ui";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
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
  /** Small line above the welcome, e.g. the hub name. */
  eyebrow: React.ReactNode;
  /** Replaces the eyebrow in the mobile block (staff show their office floor there). */
  mobileEyebrow?: React.ReactNode;
  welcome: React.ReactNode;
  /** Trailing heading-row cell on desktop. */
  aside?: React.ReactNode;
  /** Exactly three stat cells on desktop. */
  stats: OverviewStat[];
  panel: React.ReactNode;
  panelTone?: "default" | "alert";
}

/** Green uppercase hub label with its icon, shared by every console's overview. */
export function OverviewEyebrow({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5 text-base font-semibold uppercase tracking-tight text-success">
      <Icon className="size-4" aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * Panel buttons: one row of equal columns below lg (a lone button spans the
 * row, long labels wrap rather than overflow), wrapping at natural width above.
 */
export const PANEL_ACTIONS =
  "relative grid auto-cols-fr grid-flow-col gap-3 lg:flex lg:flex-wrap lg:items-center";
export const PANEL_ACTION =
  "h-auto min-h-9 min-w-0 whitespace-normal px-3 py-1.5 leading-tight lg:h-10 lg:whitespace-nowrap lg:px-4 lg:py-0";

/** Button text that shortens below lg; pair with `aria-label={label}` so the name stays complete. */
export function PanelActionLabel({
  label,
  short,
}: {
  label: string;
  short: string;
}) {
  return (
    <>
      <span className="lg:hidden">{short}</span>
      <span className="hidden lg:inline">{label}</span>
    </>
  );
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

export function Panel({
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

/** Heading row above three stat cells and the action panel; below lg, the mobile block instead. */
export function OverviewBar({
  eyebrow,
  mobileEyebrow,
  welcome,
  aside,
  stats,
  panel,
  panelTone,
}: OverviewBarProps) {
  return (
    <>
      <div
        data-testid="overview-bar-desktop"
        className="hidden overflow-hidden rounded-t-xl border border-border shadow-xs lg:grid lg:grid-cols-[repeat(3,1fr)_minmax(300px,1.5fr)]"
      >
        <div
          className={cn(
            "flex flex-col justify-center gap-1 bg-surface px-6 py-3",
            aside ? "col-span-3" : "col-span-4",
          )}
        >
          {eyebrow}
          <h1 className={WELCOME_DESKTOP}>{welcome}</h1>
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

      <OverviewMobile
        eyebrow={mobileEyebrow ?? eyebrow}
        welcome={welcome}
        stats={stats}
        panel={panel}
        panelTone={panelTone}
      />
    </>
  );
}

export const WELCOME_DESKTOP =
  "text-[2rem] font-medium leading-tight text-[#344054]";

/**
 * Stats behind a "View …" toggle for small screens: a row lifted by a slight
 * shadow, collapsed by default so the content below stays in view.
 */
export function CollapsibleStats({
  title,
  stats,
  className,
}: {
  title: React.ReactNode;
  stats: OverviewStat[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className={cn("bg-surface shadow-sm", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-ring)]"
      >
        <span className="text-lg font-medium text-fg-muted">{title}</span>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-fg transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open ? (
        // Same 2px slate separators as between the desktop stat cells.
        <div className="divide-y-[2px] divide-[#A9B5C0] border-t border-border">
          {stats.map((stat) => (
            <div key={stat.label} className={cellBg(stat)}>
              <StatCell stat={stat} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The overview below lg: welcome, action panel and collapsible stats as three
 * borderless rows in one block, only the stats row lifted by a slight shadow.
 */
export function OverviewMobile({
  eyebrow,
  welcome,
  stats,
  panel,
  panelTone,
}: {
  eyebrow?: React.ReactNode;
  welcome: React.ReactNode;
  stats: OverviewStat[];
  panel: React.ReactNode;
  panelTone?: "default" | "alert";
}) {
  const t = useTranslations("dashboard");
  return (
    <div className="flex flex-col lg:hidden">
      <div className="flex flex-col gap-2 bg-surface-muted px-4 py-5">
        {eyebrow}
        <h1 className="text-2xl font-medium leading-tight text-[#344054]">
          {welcome}
        </h1>
      </div>
      <Panel tone={panelTone} className="px-4 py-6">
        {panel}
      </Panel>
      <CollapsibleStats title={t("activity.title")} stats={stats} />
    </div>
  );
}

/** The stat cells as a grid from `md` up; a collapsible list like the home overview's below. */
export function StatGrid({
  stats,
  mobileTitle,
}: {
  stats: OverviewStat[];
  mobileTitle: string;
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:grid md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={cn(statGridCellClass(i), cellBg(stat))}
          >
            <StatCell stat={stat} />
          </div>
        ))}
      </div>
      <CollapsibleStats
        title={mobileTitle}
        stats={stats}
        className="md:hidden"
      />
    </>
  );
}
