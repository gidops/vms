"use client";

import { EXPORT_MAX_RANGE_DAYS, inclusiveDaySpan } from "@vms/contracts";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RangeCalendar,
  SegmentedControl,
} from "@vms/ui";
import { CalendarDays, Download } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import type { DateValue, RangeValue } from "react-aria-components";
import { FilterPills } from "@/app/[locale]/_components/FilterPills";
import { reportsApi } from "@/data/reports/reports.api";
import { addDaysIso, watTodayIso } from "@/shared/wat";

export type ExportFormat = "csv" | "xlsx" | "pdf";

/** Quick ranges ending today (inclusive days); "custom" uses the calendar. */
export const EXPORT_PRESETS = { week: 7, month: 30, quarter: 90 } as const;
export type ExportPreset = keyof typeof EXPORT_PRESETS | "custom";

/** The `from`/`to` (WAT YYYY-MM-DD) of a quick range ending `today`. */
export function presetRange(
  preset: keyof typeof EXPORT_PRESETS,
  today: string,
): { from: string; to: string } {
  return { from: addDaysIso(today, -(EXPORT_PRESETS[preset] - 1)), to: today };
}

export function exportRangeError(
  from: string,
  to: string,
): "missing" | "order" | "tooLong" | null {
  if (!from || !to) return "missing";
  const span = inclusiveDaySpan(from, to);
  if (span < 1) return "order";
  if (span > EXPORT_MAX_RANGE_DAYS) return "tooLong";
  return null;
}

/** Collects a WAT date range (max 366 days) and format; the server streams the file. */
export function ExportVisitorsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("export");
  const format = useFormatter();
  const today = watTodayIso();
  const [preset, setPreset] = React.useState<ExportPreset>("week");
  const [from, setFrom] = React.useState(() => presetRange("week", today).from);
  const [to, setTo] = React.useState(today);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [fileFormat, setFileFormat] = React.useState<ExportFormat>("csv");
  const [pending, setPending] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const rangeError = exportRangeError(from, to);

  // Format plain yyyy-mm-dd days as UTC so the label never shifts a day in the viewer's timezone.
  const dayLabel = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), {
      dateStyle: "medium",
      timeZone: "UTC",
    });

  const pickRange = (range: RangeValue<DateValue> | null) => {
    if (!range) return;
    setFrom(range.start.toString());
    setTo(range.end.toString());
    setPreset("custom");
    setPickerOpen(false);
  };

  const pickPreset = (next: ExportPreset) => {
    setPreset(next);
    if (next === "custom") {
      setPickerOpen(true);
      return;
    }
    const range = presetRange(next, today);
    setFrom(range.from);
    setTo(range.to);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rangeError) return;
    setPending(true);
    setFailed(false);
    try {
      await reportsApi.exportVisits({ from, to, format: fileFormat });
      onOpenChange(false);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  const errorText =
    rangeError === "order"
      ? t("rangeInvalid")
      : rangeError === "tooLong"
        ? t("rangeTooLong")
        : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>
        {/* min-w-0: a grid item, so long rows must not stretch the dialog. */}
        <form
          onSubmit={submit}
          className="flex min-w-0 flex-col gap-4"
          noValidate
        >
          {failed ? (
            <Alert intent="danger">
              <AlertDescription>{t("error")}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <FilterPills<ExportPreset>
              aria-label={t("quickRange")}
              value={preset}
              onValueChange={pickPreset}
              options={[
                { value: "week", label: t("presets.week") },
                { value: "month", label: t("presets.month") },
                { value: "quarter", label: t("presets.quarter") },
                { value: "custom", label: t("presets.custom") },
              ]}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label id="export-range-label">{t("dateRange")}</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  intent="neutral"
                  tone="outline"
                  fullWidth
                  className="justify-start"
                  aria-labelledby="export-range-label export-range-value"
                  aria-describedby={
                    errorText ? "export-range-error" : undefined
                  }
                >
                  <CalendarDays className="size-4" aria-hidden="true" />
                  <span id="export-range-value">
                    {`${dayLabel(from)} – ${dayLabel(to)}`}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto">
                <RangeCalendar
                  aria-label={t("dateRange")}
                  onChange={pickRange}
                />
              </PopoverContent>
            </Popover>
            {errorText ? (
              <span
                id="export-range-error"
                className="text-xs text-danger"
                role="alert"
              >
                {errorText}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("format")}</Label>
            <SegmentedControl
              aria-label={t("format")}
              value={fileFormat}
              onValueChange={(v) => setFileFormat(v as ExportFormat)}
              options={[
                { value: "csv", label: t("csv") },
                { value: "xlsx", label: t("excel") },
                { value: "pdf", label: t("pdf") },
              ]}
              className="w-full"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              intent="neutral"
              tone="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={pending || !!rangeError}
              aria-busy={pending || undefined}
            >
              <Download className="size-4" aria-hidden="true" />
              {pending ? t("exporting") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
