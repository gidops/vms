"use client";

import { ShieldCheck, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type * as React from "react";
import { cn } from "@vms/ui";
import {
  DecorChevrons,
  OverviewEyebrow,
  OverviewMobile,
  PANEL_ALERT_CLASS,
  STAT_SEPARATOR,
  StatCell as OverviewStatCell,
  WELCOME_DESKTOP,
  cellBg,
  type OverviewStat,
} from "@/app/[locale]/_components/OverviewBar";
import { Link } from "@/i18n/navigation";

export interface AdminOverviewProps {
  /** `vmc`: welcome across the top row; `staff`: welcome over the stats plus a pending-approvals cell. */
  variant?: "vmc" | "staff";
  eyebrow: string;
  eyebrowIcon?: LucideIcon;
  welcome: string;
  /** 3–5 stats; the grid sizes its columns to the count. */
  stats: OverviewStat[];
  pendingCount?: number;
  panel: React.ReactNode;
  panelTone?: "default" | "alert";
}

function PendingCell({ count }: { count?: number }) {
  const t = useTranslations("adminV2.overview");
  if (count === undefined) return null;
  return (
    <Link
      href="/admin/requests"
      className="flex flex-col gap-0.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      <span className="text-lg font-semibold text-primary">
        {t("pendingApprovals")}:
      </span>
      <span className="text-xl font-bold uppercase tracking-tight text-warning underline-offset-4 hover:underline">
        {t("pendingCount", { count })}
      </span>
    </Link>
  );
}

const panelClass =
  "relative flex flex-col justify-between gap-4 overflow-hidden bg-emphasis px-6 py-4 text-emphasis-fg transition-colors duration-500";

export function AdminOverview({
  variant = "vmc",
  eyebrow,
  eyebrowIcon = ShieldCheck,
  welcome,
  stats,
  pendingCount,
  panel,
  panelTone = "default",
}: AdminOverviewProps) {
  // cn (tailwind-merge) drops bg-emphasis when tinted; with both classes the
  // green wins on stylesheet order and the alert tint never shows.
  const tinted = cn(panelClass, panelTone === "alert" && PANEL_ALERT_CLASS);
  const columns = `repeat(${stats.length}, minmax(0, 1fr)) minmax(300px, 1.5fr)`;

  return (
    <>
      <div
        className="hidden overflow-hidden rounded-t-xl border border-border shadow-xs lg:grid"
        style={{ gridTemplateColumns: columns }}
      >
        {variant === "vmc" ? (
          <div
            className="flex flex-col gap-1 bg-surface px-6 py-3"
            style={{ gridColumn: "1 / -1" }}
          >
            <OverviewEyebrow icon={eyebrowIcon}>{eyebrow}</OverviewEyebrow>
            <h1 className={WELCOME_DESKTOP}>{welcome}</h1>
          </div>
        ) : (
          <>
            <div
              className="flex items-center bg-surface px-6 py-3"
              style={{ gridColumn: `span ${stats.length}` }}
            >
              <h1 className={WELCOME_DESKTOP}>{welcome}</h1>
            </div>
            <div className="flex flex-col justify-center border-s border-border bg-surface-muted px-6 py-3">
              <PendingCell count={pendingCount} />
            </div>
          </>
        )}

        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={
              "border-t border-border " +
              cellBg(stat) +
              (i > 0 ? ` border-s-[2px] ${STAT_SEPARATOR}` : "")
            }
          >
            <OverviewStatCell stat={stat} />
          </div>
        ))}
        <div className={cn(tinted, "border-s border-t border-border")}>
          <DecorChevrons />
          {panel}
        </div>
      </div>

      <OverviewMobile
        eyebrow={
          variant === "vmc" ? (
            <OverviewEyebrow icon={eyebrowIcon}>{eyebrow}</OverviewEyebrow>
          ) : (
            <PendingCell count={pendingCount} />
          )
        }
        welcome={welcome}
        stats={stats}
        panel={panel}
        panelTone={panelTone}
      />
    </>
  );
}
