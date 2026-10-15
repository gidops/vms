"use client";

import {
  AreaChart,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@vms/ui";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { useTraffic } from "@/data/admin/queries";
import { SectionCard } from "./SectionCard";

type Day = "today" | "yesterday";

/** Check-ins per hour, today or yesterday. */
export function TrafficCard({ className }: { className?: string }) {
  const t = useTranslations("admin.overview.traffic");
  const format = useFormatter();
  const [day, setDay] = React.useState<Day>("today");
  const traffic = useTraffic(day === "today" ? 0 : -1);

  const data = (traffic.data ?? []).map(({ hour, value }) => ({
    // Hour tick, localized ("08" / "٠٨").
    label: format.number(hour, { minimumIntegerDigits: 2 }),
    value,
  }));

  return (
    <SectionCard
      titleId="admin-traffic"
      title={t("title")}
      className={className}
      actions={
        <Select value={day} onValueChange={(v) => setDay(v as Day)}>
          <SelectTrigger className="h-8 w-auto gap-2" aria-label={t("range")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{t("today")}</SelectItem>
            <SelectItem value="yesterday">{t("yesterday")}</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      {traffic.isLoading ? (
        <Skeleton className="h-[232px] w-full rounded-lg" />
      ) : traffic.isError ? (
        <p role="alert" className="text-sm text-danger">
          {t("loadError")}
        </p>
      ) : (
        <AreaChart
          data={data}
          label={
            day === "today" ? t("chartLabelToday") : t("chartLabelYesterday")
          }
          height={200}
        />
      )}
    </SectionCard>
  );
}
