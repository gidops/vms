"use client";

import {
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RangeCalendar,
} from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";
import type { DateValue, RangeValue } from "react-aria-components";

export type MyVisitsTab = "today" | "upcoming" | "yesterday" | "pick";
export interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

type FixedTab = "today" | "upcoming" | "yesterday";

const container = "flex items-center gap-2 bg-primary-subtle px-6";

const pill =
  "rounded-full border bg-surface px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";

const pillState = (active: boolean) =>
  active
    ? "border-primary text-primary"
    : "border-border text-fg-muted hover:text-fg";

const startOfDayIso = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
};
const endOfDayIso = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
};

/** Scheduled-date window for the fixed pills; `upcoming` is open-ended from tomorrow. */
export function fixedTabBounds(tab: FixedTab): DateRange {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (tab === "today") {
    return { dateFrom: startOfDayIso(start), dateTo: endOfDayIso(start) };
  }
  if (tab === "yesterday") {
    const y = new Date(start);
    y.setDate(y.getDate() - 1);
    return { dateFrom: startOfDayIso(y), dateTo: endOfDayIso(y) };
  }
  const tomorrow = new Date(start);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { dateFrom: startOfDayIso(tomorrow) };
}

/** Controlled: the parent owns the tab and the derived date window. */
export function MyVisitsRangeFilter({
  value,
  onChange,
  className,
}: {
  value: MyVisitsTab;
  onChange: (next: MyVisitsTab, window: DateRange) => void;
  className?: string;
}) {
  const t = useTranslations("staff");
  const [open, setOpen] = React.useState(false);
  const [pickRange, setPickRange] =
    React.useState<RangeValue<DateValue> | null>(null);

  const fixed = (tab: FixedTab) => onChange(tab, fixedTabBounds(tab));

  const applyPick = (range: RangeValue<DateValue> | null) => {
    setPickRange(range);
    if (!range) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    onChange("pick", {
      dateFrom: startOfDayIso(range.start.toDate(tz)),
      dateTo: endOfDayIso(range.end.toDate(tz)),
    });
    setOpen(false);
  };

  return (
    <div
      role="radiogroup"
      aria-label={t("myVisits.title")}
      className={cn(container, className)}
    >
      {(["today", "upcoming", "yesterday"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          role="radio"
          aria-checked={value === tab}
          onClick={() => fixed(tab)}
          className={cn(pill, pillState(value === tab))}
        >
          {t(`range.${tab}`)}
        </button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          role="radio"
          aria-checked={value === "pick"}
          className={cn(pill, pillState(value === "pick"))}
        >
          {t("range.pickDate")}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto">
          <RangeCalendar
            aria-label={t("range.pickDate")}
            value={pickRange}
            onChange={applyPick}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
