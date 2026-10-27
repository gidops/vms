"use client";

import {
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RangeCalendar,
} from "@vms/ui";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import type { DateValue, RangeValue } from "react-aria-components";
import {
  filterPill as pill,
  filterPillState as pillState,
} from "@/app/[locale]/_components/FilterPills";

export type RecordsRange = "all" | "7d" | "custom";
export interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

/** Labels the default "All" view (no date filter); owns its interval so only this pill re-renders. */
function LiveClock() {
  const format = useFormatter();
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = format.dateTime(now, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const date = format.dateTime(now, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  return <>{`${time}, ${date}`}</>;
}

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

/** Controlled: the parent owns the range and the derived date window. */
export function RecordsRangeFilter({
  value,
  onChange,
  className,
}: {
  value: RecordsRange;
  onChange: (next: RecordsRange, range?: DateRange) => void;
  className?: string;
}) {
  const t = useTranslations("dashboard");
  const [open, setOpen] = React.useState(false);
  const [customRange, setCustomRange] =
    React.useState<RangeValue<DateValue> | null>(null);

  const selectLast7 = () => {
    const now = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 6);
    onChange("7d", { dateFrom: startOfDayIso(from), dateTo: endOfDayIso(now) });
  };

  const applyCustom = (range: RangeValue<DateValue> | null) => {
    setCustomRange(range);
    if (!range) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    onChange("custom", {
      dateFrom: startOfDayIso(range.start.toDate(tz)),
      dateTo: endOfDayIso(range.end.toDate(tz)),
    });
    setOpen(false);
  };

  return (
    <div
      role="radiogroup"
      aria-label={t("records")}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === "all"}
        aria-label={t("range.today")}
        onClick={() => onChange("all")}
        className={cn(pill, pillState(value === "all"))}
      >
        <LiveClock />
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "7d"}
        onClick={selectLast7}
        className={cn(pill, pillState(value === "7d"))}
      >
        {t("range.last7")}
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          role="radio"
          aria-checked={value === "custom"}
          className={cn(pill, pillState(value === "custom"))}
        >
          {t("range.custom")}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto">
          <RangeCalendar
            aria-label={t("range.custom")}
            value={customRange}
            onChange={applyCustom}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
