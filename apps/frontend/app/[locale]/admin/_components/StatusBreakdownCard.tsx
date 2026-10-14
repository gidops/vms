"use client";

import { DonutChart, Skeleton } from "@vms/ui";
import { useFormatter, useTranslations } from "next-intl";
import type { AdminOverviewStats } from "@/data/admin/queries";
import { SectionCard } from "./SectionCard";

/** Today's outcome split: checked in vs checked out vs rejected. */
export function StatusBreakdownCard({
  stats,
  loading,
  className,
}: {
  stats: AdminOverviewStats;
  loading: boolean;
  className?: string;
}) {
  const t = useTranslations("admin.overview.breakdown");
  const format = useFormatter();

  return (
    <SectionCard
      titleId="admin-breakdown"
      title={t("title")}
      className={className}
    >
      {loading ? (
        <Skeleton className="h-[232px] w-full rounded-lg" />
      ) : (
        <DonutChart
          label={t("chartLabel")}
          formatShare={(share) =>
            format.number(share, { style: "percent", maximumFractionDigits: 0 })
          }
          segments={[
            {
              key: "in",
              label: t("checkedIn"),
              value: stats.checkedInToday,
              tone: "success",
            },
            {
              key: "out",
              label: t("checkedOut"),
              value: stats.checkedOutToday,
              tone: "neutral",
            },
            {
              key: "rejected",
              label: t("rejected"),
              value: stats.deniedToday,
              tone: "danger",
            },
          ]}
        />
      )}
    </SectionCard>
  );
}
