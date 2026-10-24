"use client";

import {
  Alert,
  AlertDescription,
  Button,
  DetailDrawer,
  DetailSection,
  Input,
  Label,
  Spinner,
  StatusBadge,
  Textarea,
} from "@vms/ui";
import { Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
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

/**
 * One card issue: the card preview (front and back, as printed), validity,
 * linked visit and history. While the card is out: print / reprint (each is
 * logged), extend validity, and close it as returned or lost.
 */
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
      onOpenChange={(open) => !open && onClose()}
      title={a ? a.visitor.fullName : t("title")}
      description={a ? t("cardNo", { number: a.card.cardNumber }) : undefined}
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
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : isError || !a ? (
        <Alert intent="danger">
          <AlertDescription>{t("loadError")}</AlertDescription>
        </Alert>
      ) : (
        <>
          <DetailSection title={t("preview")}>
            <div className="flex gap-3 overflow-x-auto pb-1">
              <CardFront card={cardContent(a)} />
              <CardBack card={cardContent(a)} />
            </div>
            {!a.hasPhoto ? (
              <span className="text-xs text-fg-muted">{t("noPhoto")}</span>
            ) : null}
            <span className="text-xs text-fg-muted">{t("printerHint")}</span>
          </DetailSection>

          <DetailSection title={t("details")}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-fg-muted">{t("status")}</dt>
              <dd>
                <AssignmentBadge item={a} />
              </dd>
              <dt className="text-fg-muted">{t("validFrom")}</dt>
              <dd className="text-fg">{date(a.validFrom)}</dd>
              <dt className="text-fg-muted">{t("validUntil")}</dt>
              <dd className="text-fg">{date(a.validUntil)}</dd>
              <dt className="text-fg-muted">{t("issued")}</dt>
              <dd className="text-fg">
                {date(a.issuedAt)}
                {a.issuedByName ? ` · ${a.issuedByName}` : ""}
              </dd>
              <dt className="text-fg-muted">{t("prints")}</dt>
              <dd className="text-fg">
                {a.printCount === 0
                  ? t("notPrinted")
                  : t("printedTimes", {
                      count: a.printCount,
                      when: date(a.lastPrintedAt),
                    })}
              </dd>
              {a.returnedAt ? (
                <>
                  <dt className="text-fg-muted">{t("closed")}</dt>
                  <dd className="text-fg">
                    {date(a.returnedAt)}
                    {a.returnedByName ? ` · ${a.returnedByName}` : ""}
                    {a.closeNote ? ` — ${a.closeNote}` : ""}
                  </dd>
                </>
              ) : null}
              {a.notes ? (
                <>
                  <dt className="text-fg-muted">{t("notes")}</dt>
                  <dd className="text-fg">{a.notes}</dd>
                </>
              ) : null}
            </dl>
          </DetailSection>

          {a.visit ? (
            <DetailSection title={t("visit")}>
              <span className="flex flex-wrap items-center gap-2 text-sm text-fg">
                {date(a.visit.scheduledAt)} · {a.visit.purpose}
                <StatusBadge status={a.visit.status} />
              </span>
            </DetailSection>
          ) : null}

          {a.status === "ACTIVE" ? (
            <>
              <DetailSection title={t("extend")}>
                <ExtendValidity key={a.validUntil} a={a} />
              </DetailSection>
              <DetailSection title={t("close")}>
                <CloseCard a={a} />
              </DetailSection>
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
