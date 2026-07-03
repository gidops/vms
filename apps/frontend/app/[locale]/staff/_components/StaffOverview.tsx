"use client";

import { Button } from "@vms/ui";
import { Hash } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

export interface StaffStat {
  label: string;
  value: React.ReactNode;
}

export interface StaffOverviewProps {
  stats: StaffStat[];
  /** The host's office/floor (from their Host record), shown on the green panel. */
  office?: string | null;
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

/** The brand-green "book visitors" panel: office floor + title + invite action. */
function BookPanel({
  office,
  onNewInvite,
}: Pick<StaffOverviewProps, "office" | "onNewInvite">) {
  const t = useTranslations("staff");
  return (
    <>
      <DecorChevrons />
      <div className="relative flex flex-col gap-3">
        {office ? (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-accent-fg">
            <Hash className="size-3.5" aria-hidden="true" />
            {t("overview.officeFloor")}: {office}
          </span>
        ) : null}
        <h3 className="text-lg font-semibold">{t("overview.bookTitle")}</h3>
      </div>
      <div className="relative flex flex-wrap items-center gap-3">
        <Button intent="accent" onClick={onNewInvite}>
          {t("overview.newInvite")}
        </Button>
      </div>
    </>
  );
}

function StatCell({ stat }: { stat: StaffStat }) {
  return (
    <div className="flex flex-col gap-2 p-5">
      <span className="text-sm text-fg-muted">{stat.label}</span>
      <span className="text-3xl font-semibold text-fg">{stat.value}</span>
    </div>
  );
}

/**
 * Staff "Today's Schedule" overview: a row of stat cells with a flush brand-green
 * "book visitors" panel. Mirrors the VMC dashboard's overview so the two stay
 * visually consistent; on mobile the panel stacks above the stats.
 */
export function StaffOverview({
  stats,
  office,
  onNewInvite,
}: StaffOverviewProps) {
  return (
    <>
      {/* ── Desktop: stats + flush book panel in one bar ──────────────────── */}
      <div className="hidden overflow-hidden rounded-xl border border-border shadow-xs lg:grid lg:grid-cols-[repeat(3,1fr)_minmax(300px,1.15fr)]">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={"bg-surface" + (i > 0 ? " border-s border-border" : "")}
          >
            <StatCell stat={stat} />
          </div>
        ))}
        <div className="relative flex flex-col justify-between gap-6 overflow-hidden border-s border-border bg-emphasis p-5 text-emphasis-fg">
          <BookPanel office={office} onNewInvite={onNewInvite} />
        </div>
      </div>

      {/* ── Mobile: book panel on top, stats below ────────────────────────── */}
      <div className="flex flex-col gap-4 lg:hidden">
        <div className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-xl bg-emphasis p-5 text-emphasis-fg">
          <BookPanel office={office} onNewInvite={onNewInvite} />
        </div>
        <div className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs sm:grid-cols-3 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
          {stats.map((stat) => (
            <StatCell key={stat.label} stat={stat} />
          ))}
        </div>
      </div>
    </>
  );
}
