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
import { CalendarDays, Eye } from "lucide-react";
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
import {
  rfidCardsApi,
  type AssignmentDetail,
} from "@/data/rfid-cards/rfid-cards.api";
import { formatWatDateTime } from "@/shared/wat";
import { AssignmentBadge } from "./AssignmentBadge";
import { CardFront, type CardContent } from "./CardFaces";
import { CardPreviewDialog } from "./CardPreviewDialog";
import { PhotoInput } from "./PhotoInput";
import { splitWat, watIso } from "./wat-input";

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

export function cardContent(
  a: AssignmentDetail,
  localPhotoUrl: string | null = null,
): CardContent {
  return {
    fullName: a.visitor.fullName,
    organization: a.visitor.organization,
    cardNumber: a.card.cardNumber,
    validFrom: a.validFrom,
    validUntil: a.validUntil,
    // A photo picked this session that couldn't be stored wins over the saved one.
    photoUrl: localPhotoUrl ?? a.photoUrl,
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
 * Replace the card's photo. The picker always looks fresh (as if no photo was ever
 * added); a new photo replaces the saved one. If it can't be stored, it is kept
 * locally so the card can still be previewed and printed this session.
 */
function UpdatePhoto({
  a,
  currentUrl,
  onLocalPhoto,
}: {
  a: AssignmentDetail;
  currentUrl: string | null;
  onLocalPhoto: (url: string | null) => void;
}) {
  const t = useTranslations("operations.accessCards.sheet");
  const update = useUpdateRfidAssignment(a.id);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const save = async (blob: Blob, previewUrl: string) => {
    setSaving(true);
    setError(null);
    let photoKey: string;
    try {
      photoKey = await rfidCardsApi.uploadPhoto(blob);
    } catch {
      onLocalPhoto(previewUrl);
      setSaving(false);
      return;
    }
    try {
      await update.mutateAsync({ photoKey });
      URL.revokeObjectURL(previewUrl);
      onLocalPhoto(null);
    } catch (err) {
      onLocalPhoto(previewUrl);
      setError(errorText(err, t("photoError")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <PhotoInput
        compact
        value={null}
        currentUrl={currentUrl}
        disabled={saving}
        onChange={(photo) => {
          if (photo && !saving) void save(photo.blob, photo.previewUrl);
        }}
      />
      {saving ? (
        <span className="text-xs text-fg-muted" role="status">
          {t("photoSaving")}
        </span>
      ) : null}
      {error ? (
        <span className="text-xs text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Prints and reprints are each logged. */
export function AssignmentSheet({
  id,
  localPhotoUrl = null,
  previewOpen,
  onPreviewOpenChange,
  onLocalPhoto,
  onClose,
}: {
  id: string | null;
  /** Photo picked at assignment that couldn't be stored; used for preview/print only. */
  localPhotoUrl?: string | null;
  /** The enlarged card preview modal; controlled so a new card can open straight into it. */
  previewOpen: boolean;
  onPreviewOpenChange: (open: boolean) => void;
  /** A new photo that couldn't be stored (url), or null once one is saved. */
  onLocalPhoto: (url: string | null) => void;
  onClose: () => void;
}) {
  const t = useTranslations("operations.accessCards.sheet");
  const locale = useLocale();
  const { data: a, isLoading, isError } = useRfidAssignment(id);
  const printed = useMarkRfidPrinted();

  const date = (d: string | null) => (d ? formatWatDateTime(d, locale) : "—");

  return (
    <DetailDrawer
      open={!!id}
      side="start"
      onOpenChange={(open) => !open && onClose()}
      title={t("title")}
      footer={
        a ? (
          <div className="flex w-full justify-end">
            <Button onClick={() => onPreviewOpenChange(true)}>
              <Eye className="size-4" aria-hidden="true" />
              {t("previewCard")}
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
              <div className="flex items-start gap-4">
                {/* Thumbnail of the true-size face; the modal shows it large. */}
                <div className="relative h-[calc(85.6mm*0.6)] w-[calc(54mm*0.6)] shrink-0">
                  <div className="absolute left-0 top-0 origin-top-left scale-[0.6]">
                    <CardFront card={cardContent(a, localPhotoUrl)} />
                  </div>
                </div>
                {a.status === "ACTIVE" ? (
                  <UpdatePhoto
                    a={a}
                    currentUrl={localPhotoUrl ?? a.photoUrl}
                    onLocalPhoto={onLocalPhoto}
                  />
                ) : null}
              </div>
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

          <CardPreviewDialog
            open={previewOpen}
            onOpenChange={onPreviewOpenChange}
            card={cardContent(a, localPhotoUrl)}
            onPrinted={
              a.status === "ACTIVE" ? () => printed.mutate(a.id) : undefined
            }
          />
        </>
      )}
    </DetailDrawer>
  );
}
