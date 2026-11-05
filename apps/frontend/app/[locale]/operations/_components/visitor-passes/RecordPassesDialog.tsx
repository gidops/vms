"use client";

import { FLOORS, type RecordPassesResult } from "@vms/contracts";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useRecordPasses } from "@/data/visitor-passes/queries";

/** Enter passes printed before this system so they count as stock; existing IDs are skipped. */
export function RecordPassesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("operations.visitorPasses.record");
  const record = useRecordPasses();
  const [zone, setZone] = React.useState("");
  const [from, setFrom] = React.useState("1");
  const [to, setTo] = React.useState("");
  const [note, setNote] = React.useState("");
  const [result, setResult] = React.useState<RecordPassesResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fromNum = Number(from);
  const toNum = Number(to);
  const rangeValid =
    Number.isInteger(fromNum) &&
    Number.isInteger(toNum) &&
    fromNum >= 1 &&
    toNum >= fromNum &&
    toNum - fromNum < 500;
  const canSave = !!zone && rangeValid && !record.isPending;

  const close = (next: boolean) => {
    if (record.isPending) return;
    if (!next) {
      setResult(null);
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setError(null);
    setResult(null);
    record.mutate(
      {
        zone,
        from: fromNum,
        to: toNum,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: setResult,
        onError: () => setError(t("error")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        <form
          id="record-passes-form"
          onSubmit={submit}
          className="flex flex-col gap-4"
          noValidate
        >
          {error ? (
            <Alert intent="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {result ? (
            <Alert intent="success">
              <AlertDescription>
                <span className="flex flex-col gap-1">
                  <span>{t("created", { count: result.created })}</span>
                  {result.skipped.length > 0 ? (
                    <span>
                      {t("skipped", { ids: result.skipped.join(", ") })}
                    </span>
                  ) : null}
                </span>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="record-floor">{t("floor")}</Label>
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger id="record-floor">
                <SelectValue placeholder={t("pickFloor")} />
              </SelectTrigger>
              <SelectContent>
                {FLOORS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="record-from">{t("from")}</Label>
              <Input
                id="record-from"
                type="number"
                inputMode="numeric"
                min={1}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="record-to">{t("to")}</Label>
              <Input
                id="record-to"
                type="number"
                inputMode="numeric"
                min={1}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                invalid={!!to && !rangeValid}
              />
            </div>
          </div>
          {to && !rangeValid ? (
            <span className="text-xs text-danger" role="alert">
              {t("rangeInvalid")}
            </span>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="record-note">{t("note")}</Label>
            <Textarea
              id="record-note"
              value={note}
              maxLength={500}
              placeholder={t("notePlaceholder")}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            intent="neutral"
            tone="outline"
            disabled={record.isPending}
            onClick={() => close(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            form="record-passes-form"
            disabled={!canSave}
            aria-busy={record.isPending || undefined}
          >
            {record.isPending ? t("saving") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
