"use client";

import { AreaChart, DonutChart, SegmentedControl, Skeleton } from "@vms/ui";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { useTraffic, type AdminOverviewStats } from "@/data/admin/queries";

type Day = "today" | "yesterday";

/**
 * Traffic + status breakdown, restyled from the admin `SectionCard`s into the
 * VMC/staff panel language: a bordered panel with a primary toolbar heading,
 * and the two charts on `primary-subtle` cells split like the overview band.
 */
export function AdminChartsPanel({
  stats,
}: {
  stats: AdminOverviewStats | undefined;
}) {
  const t = useTranslations("admin.overview");
  const tV2 = useTranslations("adminV2.charts");
  const format = useFormatter();
  const [day, setDay] = React.useState<Day>("today");
  const traffic = useTraffic(day === "today" ? 0 : -1);

  const data = (traffic.data ?? []).map(({ hour, value }) => ({
    label: format.number(hour, { minimumIntegerDigits: 2 }),
    value,
  }));

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <h2 className="text-xl font-semibold text-primary">{tV2("title")}</h2>
        <SegmentedControl
          aria-label={t("traffic.range")}
          value={day}
          onValueChange={(v) => setDay(v as Day)}
          options={[
            { value: "today", label: t("traffic.today") },
            { value: "yesterday", label: t("traffic.yesterday") },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 border-t border-border lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-4 bg-primary-subtle p-6">
          <h3 className="text-lg font-semibold text-fg-subtle">
            {t("traffic.title")}
          </h3>
          {traffic.isLoading ? (
            <Skeleton className="h-[200px] w-full rounded-lg" />
          ) : traffic.isError ? (
            <p role="alert" className="text-sm text-danger">
              {t("traffic.loadError")}
            </p>
          ) : (
            <AreaChart
              data={data}
              label={
                day === "today"
                  ? t("traffic.chartLabelToday")
                  : t("traffic.chartLabelYesterday")
              }
              height={200}
            />
          )}
        </div>
        <div className="flex flex-col gap-4 border-t border-border bg-primary-subtle p-6 lg:border-s lg:border-t-0">
          <h3 className="text-lg font-semibold text-fg-subtle">
            {t("breakdown.title")}
          </h3>
          {stats ? (
            <DonutChart
              label={t("breakdown.chartLabel")}
              formatShare={(share) =>
                format.number(share, {
                  style: "percent",
                  maximumFractionDigits: 0,
                })
              }
              segments={[
                {
                  key: "in",
                  label: t("breakdown.checkedIn"),
                  value: stats.checkedInToday,
                  tone: "success",
                },
                {
                  key: "out",
                  label: t("breakdown.checkedOut"),
                  value: stats.checkedOutToday,
                  tone: "neutral",
                },
                {
                  key: "rejected",
                  label: t("breakdown.rejected"),
                  value: stats.deniedToday,
                  tone: "danger",
                },
              ]}
            />
          ) : (
            <Skeleton className="h-[200px] w-full rounded-lg" />
          )}
        </div>
      </div>
    </section>
  );
}
