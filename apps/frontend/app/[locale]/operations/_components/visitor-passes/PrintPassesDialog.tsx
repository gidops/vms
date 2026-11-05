"use client";

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
  Input,
  Label,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vms/ui";
import { Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import {
  FilterPills,
  SCROLLING_PILLS,
} from "@/app/[locale]/_components/FilterPills";
import {
  useCreatePasses,
  useMarkPassesPrinted,
  usePassDemand,
} from "@/data/visitor-passes/queries";
import type { CreatedBatch } from "@/data/visitor-passes/visitor-passes.api";
import { allocatePasses } from "./allocate";
import { PassPrintView } from "./PassPrintView";

const PERIODS = ["30", "90", "365"] as const;
type Period = (typeof PERIODS)[number];
const DEFAULT_TOTAL = 100;

/**
 * Plan a print run: the total is split across floor-wings by how many visitors
 * each received (editable), then the passes are numbered, printed front/back,
 * and logged as printed.
 */
export function PrintPassesDialog({
  open,
  onOpenChange,
  onPrinted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrinted: (count: number) => void;
}) {
  const t = useTranslations("operations.visitorPasses.plan");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale);
  const [period, setPeriod] = React.useState<Period>("90");
  const [total, setTotal] = React.useState(String(DEFAULT_TOTAL));
  // Per-floor edits; cleared whenever the total or period changes the suggestion.
  const [overrides, setOverrides] = React.useState<Record<string, string>>({});
  const [batch, setBatch] = React.useState<CreatedBatch | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const demand = usePassDemand(Number(period), open);
  const create = useCreatePasses();
  const markPrinted = useMarkPassesPrinted();

  const rows = demand.data ?? [];
  const totalNum = Math.max(0, Math.min(2000, Number(total) || 0));
  const suggested = allocatePasses(totalNum, rows);
  const noTraffic = rows.length > 0 && rows.every((r) => r.visits === 0);
  const qty = (zone: string) => {
    const o = overrides[zone];
    return o !== undefined
      ? Math.max(0, Number(o) || 0)
      : (suggested[zone] ?? 0);
  };
  const items = rows
    .map((r) => ({ zone: r.zone, quantity: Math.min(500, qty(r.zone)) }))
    .filter((i) => i.quantity > 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const busy = create.isPending || !!batch;

  const close = (next: boolean) => {
    if (busy) return;
    if (!next) {
      setOverrides({});
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = () => {
    setError(null);
    create.mutate(
      { items },
      {
        onSuccess: (created) => setBatch(created),
        onError: () => setError(t("error")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {error ? (
            <Alert intent="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pass-total">{t("total")}</Label>
              <Input
                id="pass-total"
                type="number"
                inputMode="numeric"
                min={0}
                max={2000}
                value={total}
                onChange={(e) => {
                  setTotal(e.target.value);
                  setOverrides({});
                }}
                className="w-32"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fg">{t("period")}</span>
              <FilterPills<Period>
                aria-label={t("period")}
                className={SCROLLING_PILLS}
                value={period}
                onValueChange={(v) => {
                  setPeriod(v);
                  setOverrides({});
                }}
                options={PERIODS.map((p) => ({
                  value: p,
                  label: t("days", { count: Number(p) }),
                }))}
              />
            </div>
          </div>

          {noTraffic ? (
            <p className="text-xs text-fg-muted">{t("noTraffic")}</p>
          ) : null}

          <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-border">
            {demand.isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("floor")}</TableHead>
                    <TableHead>{t("visits")}</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      {t("stock")}
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">
                      {t("inUse")}
                    </TableHead>
                    <TableHead>{t("quantity")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody striped>
                  {rows.map((r) => (
                    <TableRow key={r.zone}>
                      <TableCell className="text-fg">{r.zone}</TableCell>
                      <TableCell className="text-fg-muted">
                        {nf.format(r.visits)}
                      </TableCell>
                      <TableCell className="hidden text-fg-muted sm:table-cell">
                        {nf.format(r.stock)}
                      </TableCell>
                      <TableCell className="hidden text-fg-muted sm:table-cell">
                        {nf.format(r.inUse)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={500}
                          aria-label={t("quantityFor", { zone: r.zone })}
                          value={overrides[r.zone] ?? String(qty(r.zone))}
                          onChange={(e) =>
                            setOverrides((o) => ({
                              ...o,
                              [r.zone]: e.target.value,
                            }))
                          }
                          className="h-8 w-20"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-fg" aria-live="polite">
              {t("selected", { count, floors: items.length })}
            </span>
            <span className="text-xs text-fg-muted">{t("printerHint")}</span>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            intent="neutral"
            tone="outline"
            disabled={busy}
            onClick={() => close(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={count === 0 || busy}
            aria-busy={busy || undefined}
            onClick={submit}
          >
            <Printer className="size-4" aria-hidden="true" />
            {busy ? t("creating") : t("submit")}
          </Button>
        </DialogFooter>

        {batch ? (
          <PassPrintView
            passes={batch.passes}
            onDone={() => {
              const ids = batch.passes.map((p) => p.id);
              markPrinted.mutate({ ids, batchId: batch.batchId });
              onPrinted(ids.length);
              setBatch(null);
              setOverrides({});
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
