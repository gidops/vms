"use client";

import { Button } from "@vms/ui";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

export interface OverviewStat {
  label: string;
  value: React.ReactNode;
}

export interface VmcOverviewProps {
  stats: OverviewStat[];
  onRegisterWalkIn: () => void;
  onNewInvite: () => void;
}

/** Decorative stacked chevrons in the trailing-top corner of the green panel. */
function DecorChevrons() {
  return (
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
    <div className="flex flex-col gap-2 p-5">
      <span className="text-sm text-fg-muted">{stat.label}</span>
      <span className="text-3xl font-semibold text-fg">{stat.value}</span>
    </div>
  );
}

/**
 * VMC dashboard overview. Desktop: a single bar of stat cells with a flush
 * brand-green quick-actions panel at the end. Mobile: the quick-actions panel on
 * top, with the stats moved into a collapsible "View your activity" section.
 */
export function VmcOverview({
  stats,
  onRegisterWalkIn,
  onNewInvite,
}: VmcOverviewProps) {
  const t = useTranslations("dashboard");
  const [open, setOpen] = React.useState(true);

  return (
    <>
      {/* ── Desktop: stats + flush quick-actions in one bar ───────────────── */}
      <div className="hidden overflow-hidden rounded-xl border border-border shadow-xs lg:grid lg:grid-cols-[repeat(3,1fr)_minmax(300px,1.15fr)]">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={
              "bg-surface" + (i > 0 ? " border-s border-border" : "")
            }
          >
            <StatCell stat={stat} />
          </div>
        ))}
        <div className="relative flex flex-col justify-between gap-6 overflow-hidden border-s border-border bg-emphasis p-5 text-emphasis-fg">
          <QuickActions
            onRegisterWalkIn={onRegisterWalkIn}
            onNewInvite={onNewInvite}
          />
        </div>
      </div>

      {/* ── Mobile: quick-actions on top, collapsible stats below ─────────── */}
      <div className="flex flex-col gap-4 lg:hidden">
        <div className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-xl bg-emphasis p-5 text-emphasis-fg">
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
            <div className="divide-y divide-border border-t border-border">
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
