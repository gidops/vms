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

export type StaffRange = "today" | "7d" | "custom";
export interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

const pill =
  "rounded-full border bg-surface px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50";

const pillState = (active: boolean) =>
  active
    ? "border-primary text-primary"
    : "border-border text-fg-muted hover:text-fg";

/** Local start-of-day / end-of-day ISO for a JS Date (inclusive window bounds). */
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

/** Bounds for the fixed "today" / "last 7 days" pills. */
function fixedBounds(range: "today" | "7d"): DateRange {
  const now = new Date();
  const from = new Date();
  if (range === "7d") from.setDate(from.getDate() - 6);
  return { dateFrom: startOfDayIso(from), dateTo: endOfDayIso(now) };
}

/**
 * Range selector above the staff "Expected Guests" table: Today / Last 7 days
 * pills plus a "Custom" pill that opens a calendar range picker (mirrors the VMC
 * `RecordsRangeFilter`). Controlled — the parent owns the selected range and the
 * derived `{ dateFrom, dateTo }` window it feeds to the query. `disabled` greys
 * the whole control out while a search is active (search overrides the range).
 */
export function StaffRangeFilter({
  value,
  onChange,
  disabled,
  className,
}: {
  value: StaffRange;
  onChange: (next: StaffRange, range?: DateRange) => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("staff");
  const [open, setOpen] = React.useState(false);
  const [customRange, setCustomRange] =
    React.useState<RangeValue<DateValue> | null>(null);

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
      aria-label={t("expectedGuests")}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === "today"}
        disabled={disabled}
        onClick={() => onChange("today", fixedBounds("today"))}
        className={cn(pill, pillState(value === "today"))}
      >
        {t("range.today")}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "7d"}
        disabled={disabled}
        onClick={() => onChange("7d", fixedBounds("7d"))}
        className={cn(pill, pillState(value === "7d"))}
      >
        {t("range.last7")}
      </button>
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger
          role="radio"
          aria-checked={value === "custom"}
          disabled={disabled}
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
