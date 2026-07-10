"use client";

import { Button } from "@vms/ui";
import { ChevronDown, SquareActivity } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

export interface OverviewStat {
  label: string;
  value: React.ReactNode;
}

export interface VmcOverviewProps {
  /** Welcome heading, e.g. "Welcome Judith Francis". Rendered inside the bar. */
  welcome: string;
  stats: OverviewStat[];
  onRegisterWalkIn: () => void;
  onNewInvite: () => void;
}

/** "VMC HUB" eyebrow + welcome heading — the bar's white top row. */
function WelcomeHeader({ welcome }: { welcome: string }) {
  const t = useTranslations("dashboard");
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-base font-semibold uppercase tracking-tight text-success">
        <SquareActivity className="size-4" aria-hidden="true" />
        {t("hub")}
      </span>
      <h1 className="text-4xl font-semibold text-fg">{welcome}</h1>
    </div>
  );
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
function DecorChevrons() {
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

/** The brand-green quick-actions content (logo, title, action buttons). */
function QuickActions({
  onRegisterWalkIn,
  onNewInvite,
}: Pick<VmcOverviewProps, "onRegisterWalkIn" | "onNewInvite">) {
  const t = useTranslations("dashboard");
  return (
    <>
      <DecorChevrons />
      <div className="relative flex flex-col gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/afreximbank.svg"
          alt=""
          className="size-8"
          aria-hidden="true"
        />
        <h3 className="text-lg font-semibold">{t("quickActions.title")}</h3>
      </div>
      <div className="relative flex flex-wrap items-center gap-3">
        <Button intent="primary" onClick={onRegisterWalkIn}>
          {t("quickActions.registerWalkIn")}
        </Button>
        <Button intent="accent" onClick={onNewInvite}>
          {t("quickActions.newInvite")}
        </Button>
      </div>
    </>
  );
}

function StatCell({ stat }: { stat: OverviewStat }) {
  return (
    <div className="flex flex-col gap-4 p-8">
      <span className="text-xl leading-6 font-semibold text-fg-subtle">
        {stat.label}
      </span>
      <span className="text-5xl font-bold leading-[1.2] text-fg">
        {stat.value}
      </span>
    </div>
  );
}

/**
 * VMC dashboard overview, rendered as one unified bar:
 *   row 1 — "VMC HUB" eyebrow + welcome heading (full width, white)
 *   row 2 — three stat cells | brand-green quick-actions panel
 * Mobile: welcome heading, quick-actions panel, then the stats in a
 * collapsible "View your activity" section.
 */
export function VmcOverview({
  welcome,
  stats,
  onRegisterWalkIn,
  onNewInvite,
}: VmcOverviewProps) {
  const t = useTranslations("dashboard");
  const [open, setOpen] = React.useState(true);

  return (
    <>
      {/* ── Desktop: welcome + stats/quick-actions in one bar ─────────────── */}
      <div className="hidden overflow-hidden rounded-t-xl border border-border shadow-xs lg:grid lg:grid-cols-[repeat(3,1fr)_minmax(300px,1.5fr)]">
        {/* Row 1 */}
        <div className="col-span-4 bg-surface p-6">
          <WelcomeHeader welcome={welcome} />
        </div>

        {/* Row 2 */}
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={
              "border-t border-border bg-primary-subtle" +
              (i > 0 ? " border-s" : "")
            }
          >
            <StatCell stat={stat} />
          </div>
        ))}
        <div className="relative flex flex-col justify-between gap-6 overflow-hidden border-s border-t border-border bg-emphasis p-6 text-emphasis-fg">
          <QuickActions
            onRegisterWalkIn={onRegisterWalkIn}
            onNewInvite={onNewInvite}
          />
        </div>
      </div>

      {/* ── Mobile: welcome, quick-actions, collapsible stats below ───────── */}
      <div className="flex flex-col gap-4 lg:hidden">
        <WelcomeHeader welcome={welcome} />
        <div className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-xl bg-emphasis p-6 text-emphasis-fg">
          <QuickActions
            onRegisterWalkIn={onRegisterWalkIn}
            onNewInvite={onNewInvite}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-2 p-4 text-start"
          >
            <span className="text-lg font-semibold text-fg-muted">
              {t("activity.title")}
            </span>
            <ChevronDown
              className={
                "size-5 shrink-0 text-fg-muted transition-transform" +
                (open ? " rotate-180" : "")
              }
              aria-hidden="true"
            />
          </button>
          {open ? (
            <div className="divide-y divide-border border-t border-border bg-primary-subtle">
              {stats.map((stat) => (
                <StatCell key={stat.label} stat={stat} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
