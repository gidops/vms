"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Label,
  SegmentedControl,
  Spinner,
  Textarea,
} from "@vms/ui";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { RfidCardBadge } from "@/app/[locale]/_components/RfidCardBadge";
import { ApiError } from "@/data/http/client";
import { useCheckOut, useVisitRequest } from "@/data/requests/queries";
import type { HeldRfidCard } from "@/data/visits/visits.api";
import { AssignPass } from "./AssignPass";
import { formatDuration, QrPane, statusText, SummaryRow } from "./modal-shared";

type CardOutcome = "RETURNED" | "LOST";

/** Reception must say what happened to a held RFID card before the guest leaves. */
function RfidReturnSection({
  card,
  outcome,
  onOutcomeChange,
  note,
  onNoteChange,
  showErrors,
}: {
  card: HeldRfidCard;
  outcome: CardOutcome | null;
  onOutcomeChange: (o: CardOutcome) => void;
  note: string;
  onNoteChange: (n: string) => void;
  showErrors: boolean;
}) {
  const t = useTranslations("checkout.rfid");
  const tCard = useTranslations("rfidCard");
  const format = useFormatter();
  const outcomeInvalid = showErrors && outcome === null;
  const noteInvalid = showErrors && outcome === "LOST" && !note.trim();
  return (
    <section
      aria-labelledby="rfid-return-title"
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="rfid-return-title" className="text-sm font-semibold text-fg">
          {t("title")}
        </h3>
        <RfidCardBadge card={card} size="md" />
      </div>
      <p
        className={
          card.overdue ? "text-sm text-warning" : "text-sm text-fg-muted"
        }
      >
        {tCard("validUntil", {
          date: format.dateTime(new Date(card.validUntil), {
            dateStyle: "medium",
          }),
        })}
      </p>
      <span id="rfid-outcome-label" className="text-sm font-medium text-fg">
        {t("question")}
      </span>
      <SegmentedControl
        options={[
          { value: "RETURNED", label: t("returned") },
          { value: "LOST", label: t("lost") },
        ]}
        value={outcome}
        onValueChange={(v) => onOutcomeChange(v as CardOutcome)}
        tone="primary"
        required
        invalid={outcomeInvalid}
        aria-labelledby="rfid-outcome-label"
        aria-describedby={outcomeInvalid ? "rfid-outcome-error" : undefined}
        fullWidth
      />
      {outcomeInvalid ? (
        <span id="rfid-outcome-error" className="text-sm text-danger">
          {t("answerRequired")}
        </span>
      ) : null}
      {outcome === "LOST" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rfid-note">{t("noteLabel")}</Label>
          <Textarea
            id="rfid-note"
            rows={2}
            maxLength={1000}
            required
            value={note}
            placeholder={t("notePlaceholder")}
            onChange={(e) => onNoteChange(e.target.value)}
            invalid={noteInvalid}
            aria-describedby={noteInvalid ? "rfid-note-error" : undefined}
          />
          {noteInvalid ? (
            <span id="rfid-note-error" className="text-sm text-danger">
              {t("noteRequired")}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function CheckOutModal({
  visitId,
  onClose,
}: {
  visitId: string;
  onClose: () => void;
}) {
  const t = useTranslations("checkout");
  const detailQ = useVisitRequest(visitId);
  const checkOut = useCheckOut(visitId);
  const [changing, setChanging] = React.useState(false);
  const [cardId, setCardId] = React.useState("");
  const [now, setNow] = React.useState(() => Date.now());
  const [cardOutcome, setCardOutcome] = React.useState<CardOutcome | null>(
    null,
  );
  const [cardNote, setCardNote] = React.useState("");
  const [showErrors, setShowErrors] = React.useState(false);

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const visit = detailQ.data;
  const invited = visit ? visit.type !== "WALK_IN" : false;
  const duration =
    visit?.checkInAt != null
      ? formatDuration(now - new Date(visit.checkInAt).getTime())
      : "—";

  const rfidCard = visit?.rfidCard ?? null;
  const cardAnswered =
    !rfidCard ||
    cardOutcome === "RETURNED" ||
    (cardOutcome === "LOST" && cardNote.trim() !== "");

  // The server's 400/403/422 message (e.g. no rfid:return permission) is actionable.
  const errorText =
    checkOut.error instanceof ApiError &&
    [400, 403, 422].includes(checkOut.error.status)
      ? checkOut.error.message
      : t("error");

  async function complete() {
    if (!cardAnswered) {
      setShowErrors(true);
      return;
    }
    try {
      await checkOut.mutateAsync({
        ...(cardId ? { accessCardId: cardId } : {}),
        ...(rfidCard && cardOutcome
          ? {
              rfidCard:
                cardOutcome === "LOST"
                  ? { outcome: "LOST", note: cardNote.trim() }
                  : { outcome: "RETURNED" },
            }
          : {}),
      });
      onClose();
    } catch {
      /* surfaced below */
    }
  }

  const right = !visit ? (
    <div className="flex h-64 items-center justify-center">
      <Spinner />
    </div>
  ) : (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 text-center">
        {/* check-out always follows a check-in, so the gate step is done */}
        {invited ? (
          <Badge intent="success" tone="soft">
            {t("gateDone")}
          </Badge>
        ) : null}
        <h2 className="text-xl font-semibold text-danger">
          {t("confirmTitle")}
        </h2>
        <p className="text-sm text-fg-muted">{t("confirmSubtitle")}</p>
      </div>

      <div className="flex flex-col items-center gap-1">
        {changing ? (
          <AssignPass value={cardId} onChange={setCardId} />
        ) : (
          <span className="rounded-lg bg-warning-subtle px-8 py-2 text-xl font-bold tracking-[0.2em] text-warning">
            {visit.pass?.cardNumber ?? "—"}
          </span>
        )}
        <button
          type="button"
          onClick={() => setChanging((c) => !c)}
          className="text-sm font-medium text-primary underline"
        >
          {t("changePassId")}
        </button>
      </div>

      <div className="rounded-lg bg-surface-muted/60 px-4">
        <SummaryRow label={t("guestName")} value={visit.visitor.fullName} />
        <SummaryRow
          label={t("host")}
          value={visit.host?.user.fullName ?? "—"}
        />
        <SummaryRow label={t("purpose")} value={visit.purpose} />
        <SummaryRow
          label={t("status")}
          value={statusText(visit.status)}
          accent="success"
        />
        {!invited ? (
          <SummaryRow
            label={t("timeInFacility")}
            value={duration}
            accent="success"
          />
        ) : null}
      </div>

      {rfidCard ? (
        <RfidReturnSection
          card={rfidCard}
          outcome={cardOutcome}
          onOutcomeChange={setCardOutcome}
          note={cardNote}
          onNoteChange={setCardNote}
          showErrors={showErrors}
        />
      ) : null}

      {checkOut.isError ? (
        <p role="alert" className="text-sm text-danger">
          {errorText}
        </p>
      ) : null}

      <Button
        intent="danger"
        tone="outline"
        fullWidth
        disabled={checkOut.isPending}
        onClick={complete}
      >
        {t("complete")}
      </Button>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={
          invited
            ? "flex w-[calc(100%-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 md:flex-row"
            : "max-w-md"
        }
      >
        <DialogTitle className="sr-only">{t("confirmTitle")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("confirmSubtitle")}
        </DialogDescription>
        {invited ? (
          <>
            <QrPane
              tone="danger"
              qrCode={visit?.qrCode}
              code={visit?.referenceCode}
              hint={
                <>
                  {t("onsiteFor", { duration })}
                  <br />
                  <span className="font-semibold text-danger underline">
                    {t("alreadyCheckedIn")}
                  </span>
                </>
              }
            />
            <div className="flex-1 p-8">{right}</div>
          </>
        ) : (
          right
        )}
      </DialogContent>
    </Dialog>
  );
}
