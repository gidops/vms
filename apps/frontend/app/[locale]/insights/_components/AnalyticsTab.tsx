"use client";

import type {
  InsightsAnalytics,
  InsightsCount,
  InsightsRange,
} from "@vms/contracts";
import {
  Alert,
  AlertDescription,
  BarChart,
  cn,
  DonutChart,
  Spinner,
  type DonutTone,
} from "@vms/ui";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import {
  cellBg,
  StatCell,
  statGridCellClass,
  type OverviewStat,
} from "@/app/[locale]/_components/OverviewBar";
import { FilterPills } from "@/app/[locale]/_components/FilterPills";
import { useInsightsAnalytics } from "@/data/insights/queries";
import { watDateLocale } from "@/shared/wat";

const RANGES: InsightsRange[] = ["7d", "30d", "90d"];

const STATUS_TONE: Record<string, DonutTone> = {
  CHECKED_OUT: "success",
  CHECKED_IN: "primary",
  APPROVED: "info",
  PENDING: "warning",
  REVIEW_REQUESTED: "warning",
  FLAGGED: "danger",
  DENIED: "danger",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
};
const TYPE_TONE: Record<string, DonutTone> = {
  WALK_IN: "warning",
  PRE_INVITED: "primary",
  APPOINTMENT: "info",
};

function Panel({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border bg-surface p-5",
        className,
      )}
    >
      <h3 className="text-lg font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

function StatGrid({ stats }: { stats: OverviewStat[] }) {
  return (
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
  );
}

/** A ranked "top N" list with a proportional bar behind each count. */
function RankList({ items, empty }: { items: InsightsCount[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-fg-subtle">{empty}</p>;
  }
  const max = Math.max(...items.map((i) => i.count));
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.key} className="flex flex-col gap-1 text-sm">
          <span className="flex justify-between gap-3">
            <span className="truncate text-fg">{item.key}</span>
            <span className="font-medium text-fg">{item.count}</span>
          </span>
          <span className="h-1.5 rounded-full bg-surface-muted">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}

function Charts({ data }: { data: InsightsAnalytics }) {
  const t = useTranslations("insights.analytics");
  const tStatus = useTranslations("insights.status");
  const tType = useTranslations("insights.visitType");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale);
  const self = data.scope === "self";
  const range = t(`ranges.${data.range}`);

  // Calendar days are plain yyyy-mm-dd; format as UTC so they never shift.
  const dayFmt = new Intl.DateTimeFormat(watDateLocale(locale), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const day = (iso: string) => dayFmt.format(new Date(`${iso}T00:00:00Z`));
  const minutes = (m: number | null) =>
    m === null ? "—" : t("minutes", { count: m });

  const totals = data.totals;
  const stats: OverviewStat[] = self
    ? [
        {
          label: t("kpi.hosted"),
          value: nf.format(totals.visits),
          hint: range,
        },
        { label: t("kpi.allTime"), value: nf.format(totals.allTimeVisits) },
        { label: t("kpi.upcoming"), value: nf.format(totals.upcoming) },
        { label: t("kpi.avgStay"), value: minutes(totals.avgDurationMinutes) },
      ]
    : [
        {
          label: t("kpi.visits"),
          value: nf.format(totals.visits),
          hint: range,
        },
        {
          label: t("kpi.uniqueVisitors"),
          value: nf.format(totals.uniqueVisitors),
        },
        {
          label: t("kpi.arrived"),
          value: nf.format(totals.arrived),
          hint: t("kpi.noShows", { count: totals.noShows }),
        },
        { label: t("kpi.avgStay"), value: minutes(totals.avgDurationMinutes) },
      ];

  const statusSegments = data.byStatus.map((s) => ({
    key: s.key,
    label: tStatus(s.key),
    value: s.count,
    tone: STATUS_TONE[s.key] ?? "neutral",
  }));

  return (
    <div className="flex flex-col gap-6">
      <StatGrid stats={stats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("daily")}>
          <BarChart
            label={`${t("daily")}, ${range}`}
            data={data.daily.map((d) => ({
              key: d.date,
              label: day(d.date),
              value: d.count,
            }))}
          />
        </Panel>
        <Panel title={t("weekly")}>
          <BarChart
            label={t("weekly")}
            labelEvery={2}
            data={data.weekly.map((w) => ({
              key: w.weekStart,
              label: day(w.weekStart),
              value: w.count,
            }))}
          />
        </Panel>

        {self ? null : (
          <Panel title={t("hourly")}>
            <BarChart
              label={`${t("hourly")}, ${range}`}
              labelEvery={3}
              tone="success"
              data={data.hourly.map((h) => ({
                key: String(h.hour),
                label: String(h.hour).padStart(2, "0"),
                value: h.count,
              }))}
            />
          </Panel>
        )}

        <Panel title={self ? t("outcomes") : t("statusMix")}>
          <DonutChart
            label={`${self ? t("outcomes") : t("statusMix")}, ${range}`}
            segments={statusSegments}
          />
        </Panel>

        {self ? (
          <Panel title={t("repeatVisitors")}>
            <RankList items={data.topVisitors} empty={t("noRepeat")} />
          </Panel>
        ) : (
          <>
            <Panel title={t("visitMix")}>
              <DonutChart
                label={`${t("visitMix")}, ${range}`}
                segments={data.byType.map((s) => ({
                  key: s.key,
                  label: tType(s.key),
                  value: s.count,
                  tone: TYPE_TONE[s.key] ?? "neutral",
                }))}
              />
            </Panel>
            <Panel title={t("onsiteByFloor")}>
              <RankList items={data.onsiteByFloor} empty={t("nobodyOnsite")} />
            </Panel>
            <Panel title={t("topHosts")}>
              <RankList items={data.topHosts} empty={t("noData")} />
            </Panel>
            <Panel title={t("topOrganizations")}>
              <RankList items={data.topOrganizations} empty={t("noData")} />
            </Panel>
          </>
        )}
      </div>

      {data.security ? (
        <section className="flex flex-col gap-4">
          <h3 className="text-xl font-semibold text-primary">
            {t("security.title")}
          </h3>
          <StatGrid
            stats={[
              {
                label: t("security.flagged"),
                value: nf.format(data.security.flagged),
                hint: range,
              },
              {
                label: t("security.alertsRaised"),
                value: nf.format(data.security.alertsRaised),
                hint: range,
              },
              {
                label: t("security.alertsOpen"),
                value: nf.format(data.security.alertsOpen),
                tone: data.security.alertsOpen > 0 ? "warning" : "default",
              },
              {
                label: t("security.denied"),
                value: nf.format(totals.denied),
                hint: range,
              },
            ]}
          />
          <Panel title={t("security.deniedDaily")}>
            <BarChart
              label={`${t("security.deniedDaily")}, ${range}`}
              tone="danger"
              data={data.security.deniedDaily.map((d) => ({
                key: d.date,
                label: day(d.date),
                value: d.count,
              }))}
            />
          </Panel>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Analytics: visit volumes and trends over the last 7 / 30 / 90 days (WAT).
 * Staff see their own visits (hosted, upcoming, repeat visitors); facility
 * readers see everyone's (daily / weekly volume, peak hours, visit mix, top
 * hosts and organisations, who is on site); the Security Manager and System
 * Admin also get the security trends.
 */
export function AnalyticsTab() {
  const t = useTranslations("insights.analytics");
  const [range, setRange] = React.useState<InsightsRange>("30d");
  const { data, isLoading, isError } = useInsightsAnalytics(range);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <FilterPills
          aria-label={t("range")}
          value={range}
          onValueChange={setRange}
          options={RANGES.map((value) => ({
            value,
            label: t(`ranges.${value}`),
          }))}
        />
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : isError || !data ? (
        <Alert intent="danger">
          <AlertDescription>{t("error")}</AlertDescription>
        </Alert>
      ) : (
        <Charts data={data} />
      )}
    </section>
  );
}
