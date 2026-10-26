"use client";

import { Alert, AlertDescription, cn, Spinner } from "@vms/ui";
import { useLocale, useTranslations } from "next-intl";
import {
  cellBg,
  StatCell,
  statGridCellClass,
  type OverviewStat,
} from "@/app/[locale]/_components/OverviewBar";
import { useInsightsOverview } from "@/data/insights/queries";

/**
 * Overview: a handful of today's facility-wide numbers (WAT day), refreshed
 * every minute. Deliberately minimal; trends live under Analytics.
 */
export function OverviewTab() {
  const t = useTranslations("insights.overview");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale);
  const { data, isLoading, isError } = useInsightsOverview();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <Alert intent="danger">
        <AlertDescription>{t("error")}</AlertDescription>
      </Alert>
    );
  }

  const stats: OverviewStat[] = [
    {
      label: t("onsite"),
      value: nf.format(data.onsite),
      hint: t("onsiteFloors", { count: data.onsiteFloors }),
    },
    {
      label: t("visitorsToday"),
      value: nf.format(data.visitorsToday),
      hint: t("yesterday", { count: data.visitorsYesterday }),
    },
    {
      label: t("expected"),
      value: nf.format(data.expected),
      hint: t("expectedHint"),
    },
    {
      label: t("checkedOut"),
      value: nf.format(data.checkedOutToday),
      hint: t("checkedInHint", { count: data.checkedInToday }),
    },
  ];

  return (
    <section
      aria-labelledby="insights-overview-heading"
      className="flex flex-col gap-4"
    >
      <h2
        id="insights-overview-heading"
        className="text-2xl font-semibold text-primary"
      >
        {t("title")}
      </h2>
      <div className="grid overflow-hidden rounded-xl border border-border sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={cn(statGridCellClass(i), cellBg(stat))}
          >
            <StatCell stat={stat} />
          </div>
        ))}
      </div>
    </section>
  );
}
