"use client";

import {
  Alert,
  AlertDescription,
  Avatar,
  Button,
  DetailDrawer,
  Input,
  Label,
  Spinner,
  StatusBadge,
  Textarea,
} from "@vms/ui";
import { CalendarDays, Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Field } from "@/app/[locale]/_components/visit-detail/helpers";
import { SheetSection } from "@/app/[locale]/_components/visit-detail/sections/SheetSection";
import { ApiError } from "@/data/http/client";
import {
  useCloseRfidAssignment,
  useMarkRfidPrinted,
  useRfidAssignment,
  useUpdateRfidAssignment,
} from "@/data/rfid-cards/queries";
import type { AssignmentDetail } from "@/data/rfid-cards/rfid-cards.api";
import { formatWatDateTime } from "@/shared/wat";
import { AssignmentBadge } from "./AssignmentBadge";
import { CardBack, CardFront, type CardContent } from "./CardFaces";
import { CardPrintView } from "./CardPrintView";
import { splitWat, watIso } from "./wat-input";

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

export function cardContent(a: AssignmentDetail): CardContent {
  return {
    fullName: a.visitor.fullName,
    organization: a.visitor.organization,
    cardNumber: a.card.cardNumber,
    validFrom: a.validFrom,
    validUntil: a.validUntil,
    photoUrl: a.photoUrl,
  };
}

/** Move the end of an active card's validity. */
function ExtendValidity({ a }: { a: AssignmentDetail }) {
  const t = useTranslations("operations.accessCards.sheet");
  const update = useUpdateRfidAssignment(a.id);
  const [value, setValue] = React.useState(() => splitWat(a.validUntil));
  const next = watIso(value.date, value.time);
  const invalid = !next || next <= new Date(a.validFrom).toISOString();
  const unchanged = next === new Date(a.validUntil).toISOString();

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="extend-date">{t("validUntil")}</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="extend-date"
          type="date"
          value={value.date}
          onChange={(e) => setValue((v) => ({ ...v, date: e.target.value }))}
          className="w-auto"
        />
        <Input
          type="time"
          aria-label={t("validUntilTime")}
          value={value.time}
          onChange={(e) => setValue((v) => ({ ...v, time: e.target.value }))}
          className="w-auto"
        />
        <Button
          type="button"
          intent="neutral"
          tone="outline"
          disabled={invalid || unchanged || update.isPending}
          onClick={() => update.mutate({ validUntil: next })}
        >
          {t("saveValidity")}
        </Button>
      </div>
      {update.isError ? (
        <span className="text-xs text-danger" role="alert">
          {errorText(update.error, t("error"))}
        </span>
      ) : null}
    </div>
  );
}

/** Close the card: it came back, or it is lost. */
function CloseCard({ a }: { a: AssignmentDetail }) {
  const t = useTranslations("operations.accessCards.sheet");
  const close = useCloseRfidAssignment(a.id);
  const [note, setNote] = React.useState("");
  const run = (outcome: "RETURNED" | "LOST") =>
    close.mutate({ outcome, ...(note.trim() ? { note: note.trim() } : {}) });

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        aria-label={t("closeNote")}
        placeholder={t("closeNote")}
        value={note}
        maxLength={1000}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={close.isPending}
          onClick={() => run("RETURNED")}
        >
          {t("markReturned")}
        </Button>
        <Button
          type="button"
          intent="danger"
          tone="outline"
          disabled={close.isPending}
          onClick={() => run("LOST")}
        >
          {t("markLost")}
        </Button>
      </div>
      {close.isError ? (
        <span className="text-xs text-danger" role="alert">
          {errorText(close.error, t("error"))}
        </span>
      ) : null}
    </div>
  );
}

/** Prints and reprints are each logged. */
export function AssignmentSheet({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("operations.accessCards.sheet");
  const locale = useLocale();
  const { data: a, isLoading, isError } = useRfidAssignment(id);
  const printed = useMarkRfidPrinted();
  const [printing, setPrinting] = React.useState(false);

  const date = (d: string | null) => (d ? formatWatDateTime(d, locale) : "—");

  return (
    <DetailDrawer
      open={!!id}
      side="start"
      onOpenChange={(open) => !open && onClose()}
      title={t("title")}
      footer={
        a?.status === "ACTIVE" ? (
          <div className="flex w-full justify-end">
            <Button onClick={() => setPrinting(true)} disabled={printing}>
              <Printer className="size-4" aria-hidden="true" />
              {a.printCount > 0 ? t("reprint") : t("print")}
            </Button>
          </div>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : isError || !a ? (
        <Alert intent="danger">
          <AlertDescription>{t("loadError")}</AlertDescription>
        </Alert>
      ) : (
        <>
          <SheetSection title={t("visitorInfo")}>
            <div className="flex items-start justify-between gap-3 rounded-lg bg-surface-muted p-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={a.visitor.fullName} size="md" />
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-fg">
                    {a.visitor.fullName}
                  </span>
                  {a.visitor.organization ? (
                    <span className="text-sm text-fg-muted">
                      {a.visitor.organization}
                    </span>
                  ) : null}
                  <span className="text-sm text-fg-muted">
                    {a.visitor.email} ·{" "}
                    <span className="font-mono">
                      {t("cardNo", { number: a.card.cardNumber })}
                    </span>
                  </span>
                </div>
              </div>
              <AssignmentBadge item={a} />
            </div>
          </SheetSection>

          <SheetSection title={t("preview")}>
            <div className="flex flex-col gap-2">
              <div className="flex gap-3 overflow-x-auto pb-1">
                <CardFront card={cardContent(a)} />
                <CardBack card={cardContent(a)} />
              </div>
              {!a.hasPhoto ? (
                <span className="text-xs text-fg-muted">{t("noPhoto")}</span>
              ) : null}
              <span className="text-xs text-fg-muted">{t("printerHint")}</span>
            </div>
          </SheetSection>

          <SheetSection title={t("details")}>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("validFrom")}>{date(a.validFrom)}</Field>
              <Field label={t("validUntil")}>{date(a.validUntil)}</Field>
              <Field label={t("issued")}>
                {date(a.issuedAt)}
                {a.issuedByName ? ` · ${a.issuedByName}` : ""}
              </Field>
              <Field label={t("prints")}>
                {a.printCount === 0
                  ? t("notPrinted")
                  : t("printedTimes", {
                      count: a.printCount,
                      when: date(a.lastPrintedAt),
                    })}
              </Field>
              {a.returnedAt ? (
                <div className="col-span-2">
                  <Field label={t("closed")}>
                    {date(a.returnedAt)}
                    {a.returnedByName ? ` · ${a.returnedByName}` : ""}
                    {a.closeNote ? ` — ${a.closeNote}` : ""}
                  </Field>
                </div>
              ) : null}
              {a.notes ? (
                <div className="col-span-2">
                  <Field label={t("notes")}>{a.notes}</Field>
                </div>
              ) : null}
            </div>
          </SheetSection>

          {a.visit ? (
            <SheetSection title={t("visit")}>
              <div className="flex items-start gap-3 py-1">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted">
                  <CalendarDays className="size-5" aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-fg">
                    {date(a.visit.scheduledAt)}
                  </span>
                  <span className="text-sm text-fg-muted">
                    {a.visit.purpose}
                  </span>
                </div>
                <StatusBadge status={a.visit.status} />
              </div>
            </SheetSection>
          ) : null}

          {a.status === "ACTIVE" ? (
            <>
              <SheetSection title={t("extend")}>
                <ExtendValidity key={a.validUntil} a={a} />
              </SheetSection>
              <SheetSection title={t("close")}>
                <CloseCard a={a} />
              </SheetSection>
            </>
          ) : null}

          {printing ? (
            <CardPrintView
              card={cardContent(a)}
              onDone={() => {
                setPrinting(false);
                printed.mutate(a.id);
              }}
            />
          ) : null}
        </>
      )}
    </DetailDrawer>
  );
}
