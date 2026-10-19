"use client";

import { EXPORT_MAX_RANGE_DAYS, inclusiveDaySpan } from "@vms/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Label,
  SegmentedControl,
} from "@vms/ui";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { reportsApi } from "@/data/reports/reports.api";
import { addDaysIso, watTodayIso } from "@/shared/wat";

export type ExportFormat = "csv" | "xlsx";

/** Range check shared by the dialog and its tests. */
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

/**
 * "Export Visitor Data": a WAT visit-date range (max 366 days) and CSV / Excel.
 * The server streams the file; this only collects the choice and downloads it.
 */
export function ExportVisitorsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("export");
  const today = watTodayIso();
  const [from, setFrom] = React.useState(() => addDaysIso(today, -1));
  const [to, setTo] = React.useState(today);
  const [format, setFormat] = React.useState<ExportFormat>("csv");
  const [pending, setPending] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const rangeError = exportRangeError(from, to);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rangeError) return;
    setPending(true);
    setFailed(false);
    try {
      await reportsApi.exportVisits({ from, to, format });
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
      <DialogContent size="lg" hideClose className="gap-6 p-8">
        <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
          <div className="flex flex-col gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary-subtle text-primary">
              <Download className="size-6" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-2xl">{t("title")}</DialogTitle>
              <DialogDescription className="text-base">
                {t("subtitle")}
              </DialogDescription>
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg">
              {t("dateRange")}
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="export-from">{t("from")}</Label>
                <Input
                  id="export-from"
                  type="date"
                  value={from}
                  max={to || undefined}
                  required
                  invalid={rangeError === "order"}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="export-to">{t("to")}</Label>
                <Input
                  id="export-to"
                  type="date"
                  value={to}
                  min={from || undefined}
                  required
                  invalid={rangeError === "order" || rangeError === "tooLong"}
                  aria-describedby="export-range-hint"
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>
            <p
              id="export-range-hint"
              className={
                errorText ? "text-sm text-danger" : "text-sm text-fg-muted"
              }
              role={errorText ? "alert" : undefined}
            >
              {errorText ?? t("hint")}
            </p>
          </fieldset>

          <div className="flex flex-col gap-2">
            <span
              id="export-format-label"
              className="text-xs font-semibold uppercase tracking-wide text-fg"
            >
              {t("format")}
            </span>
            <SegmentedControl
              aria-label={t("format")}
              value={format}
              onValueChange={(v) => setFormat(v as ExportFormat)}
              options={[
                { value: "csv", label: t("csv") },
                { value: "xlsx", label: t("excel") },
              ]}
              className="self-start"
            />
          </div>

          {failed ? (
            <p role="alert" className="text-sm text-danger">
              {t("error")}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              intent="neutral"
              tone="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              intent="primary"
              size="lg"
              disabled={pending || !!rangeError}
              aria-busy={pending || undefined}
            >
              {pending ? t("exporting") : t("submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
