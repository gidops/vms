"use client";

import {
  Alert,
  AlertDescription,
  Avatar,
  Button,
  DetailDrawer,
  Input,
  Label,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Textarea,
} from "@vms/ui";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { SheetSection } from "@/app/[locale]/_components/visit-detail/sections/SheetSection";
import { ApiError } from "@/data/http/client";
import type { VisitorItem } from "@/data/insights/insights.api";
import {
  useInsightsVisitor,
  useInsightsVisitors,
} from "@/data/insights/queries";
import type { AssignmentDetail } from "@/data/rfid-cards/rfid-cards.api";
import { rfidCardsApi } from "@/data/rfid-cards/rfid-cards.api";
import { useAssignRfidCard } from "@/data/rfid-cards/queries";
import { useDebounced } from "@/shared/useDebounced";
import { formatWatDateTime } from "@/shared/wat";
import { PhotoInput, type PickedPhoto } from "./PhotoInput";
import { defaultValidity, watIso } from "./wat-input";

const NO_VISIT = "none";

/** Find the visitor the card is for (any visitor on record). */
function VisitorPicker({
  value,
  onChange,
}: {
  value: VisitorItem | null;
  onChange: (visitor: VisitorItem | null) => void;
}) {
  const t = useTranslations("operations.accessCards.assign");
  const [search, setSearch] = React.useState("");
  const debounced = useDebounced(search.trim());
  const list = useInsightsVisitors({
    search: debounced || undefined,
    pageSize: 6,
  });

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={value.fullName} size="md" accent="single" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-fg">
              {value.fullName}
            </span>
            <span className="truncate text-xs text-fg-muted">
              {[value.email, value.organization].filter(Boolean).join(" · ")}
            </span>
          </span>
        </span>
        <Button
          type="button"
          size="sm"
          intent="neutral"
          tone="ghost"
          onClick={() => onChange(null)}
        >
          {t("change")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <SearchInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClear={() => setSearch("")}
        placeholder={t("visitorSearch")}
        aria-label={t("visitorSearch")}
      />
      {list.isLoading ? (
        <Spinner />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {(list.data?.items ?? []).map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => onChange(v)}
                className="flex w-full items-center gap-3 px-3 py-2 text-start outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
              >
                <Avatar name={v.fullName} size="sm" accent="single" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-fg">
                    {v.fullName}
                  </span>
                  <span className="truncate text-xs text-fg-muted">
                    {v.email}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {list.data && list.data.items.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-fg-subtle">
              {t("noVisitors")}
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

/** Optionally tie the card to one of the visitor's visits. */
function VisitPicker({
  visitorId,
  value,
  onChange,
}: {
  visitorId: string;
  value: string;
  onChange: (visitId: string) => void;
}) {
  const t = useTranslations("operations.accessCards.assign");
  const locale = useLocale();
  const detail = useInsightsVisitor(visitorId);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id="assign-visit" aria-label={t("visit")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_VISIT}>{t("noVisit")}</SelectItem>
        {(detail.data?.visits ?? []).slice(0, 20).map((v) => (
          <SelectItem key={v.id} value={v.id}>
            {[
              v.scheduledAt ? formatWatDateTime(v.scheduledAt, locale) : null,
              v.purpose,
            ]
              .filter(Boolean)
              .join(" · ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The card is registered on first use. */
export function AssignCardDrawer({
  open,
  onOpenChange,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: (assignment: AssignmentDetail) => void;
}) {
  const t = useTranslations("operations.accessCards.assign");
  const assign = useAssignRfidCard();
  const [visitor, setVisitor] = React.useState<VisitorItem | null>(null);
  const [visitId, setVisitId] = React.useState(NO_VISIT);
  const [cardNumber, setCardNumber] = React.useState("");
  const [validity, setValidity] = React.useState(defaultValidity);
  const [photo, setPhoto] = React.useState<PickedPhoto | null>(null);
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reset = () => {
    setVisitor(null);
    setVisitId(NO_VISIT);
    setCardNumber("");
    setValidity(defaultValidity());
    setPhoto(null);
    setNotes("");
    setError(null);
  };

  const from = watIso(validity.fromDate, validity.fromTime);
  const until = watIso(validity.untilDate, validity.untilTime);
  const rangeInvalid = !from || !until || until <= from;
  const canSave = !!visitor && !!cardNumber.trim() && !rangeInvalid && !pending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitor || !canSave) return;
    setPending(true);
    setError(null);
    try {
      const photoKey = photo
        ? await rfidCardsApi.uploadPhoto(photo.blob)
        : undefined;
      const created = await assign.mutateAsync({
        cardNumber: cardNumber.trim(),
        visitorId: visitor.id,
        ...(visitId !== NO_VISIT ? { visitId } : {}),
        validFrom: from,
        validUntil: until,
        ...(photoKey ? { photoKey } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      reset();
      onAssigned(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setPending(false);
    }
  };

  const field = (key: keyof typeof validity) => ({
    value: validity[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setValidity((v) => ({ ...v, [key]: e.target.value })),
  });

  return (
    <DetailDrawer
      open={open}
      side="start"
      onOpenChange={(next) => !pending && onOpenChange(next)}
      title={t("title")}
      description={t("subtitle")}
      footer={
        <div className="flex w-full justify-end gap-3">
          <Button
            type="button"
            intent="neutral"
            tone="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            form="assign-card-form"
            disabled={!canSave}
            aria-busy={pending || undefined}
          >
            {pending ? t("saving") : t("submit")}
          </Button>
        </div>
      }
    >
      <form
        id="assign-card-form"
        onSubmit={(e) => void submit(e)}
        className="flex flex-col gap-6"
        noValidate
      >
        {error ? (
          <Alert intent="danger">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <SheetSection title={t("visitor")}>
          <VisitorPicker
            value={visitor}
            onChange={(v) => {
              setVisitor(v);
              setVisitId(NO_VISIT);
            }}
          />
          {visitor ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assign-visit">{t("visit")}</Label>
              <VisitPicker
                visitorId={visitor.id}
                value={visitId}
                onChange={setVisitId}
              />
            </div>
          ) : null}
        </SheetSection>

        <SheetSection title={t("card")}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assign-card-number">{t("cardNumber")}</Label>
            <Input
              id="assign-card-number"
              required
              autoComplete="off"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              className="font-mono uppercase"
            />
            <span className="text-xs text-fg-muted">{t("cardNumberHint")}</span>
          </div>
        </SheetSection>

        <SheetSection title={t("validity")}>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assign-from-date">{t("validFrom")}</Label>
              <Input id="assign-from-date" type="date" {...field("fromDate")} />
              <Input
                type="time"
                aria-label={t("validFromTime")}
                {...field("fromTime")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assign-until-date">{t("validUntil")}</Label>
              <Input
                id="assign-until-date"
                type="date"
                min={validity.fromDate}
                {...field("untilDate")}
              />
              <Input
                type="time"
                aria-label={t("validUntilTime")}
                {...field("untilTime")}
              />
            </div>
          </div>
          <span
            className={
              rangeInvalid ? "text-xs text-danger" : "text-xs text-fg-muted"
            }
            role={rangeInvalid ? "alert" : undefined}
          >
            {rangeInvalid ? t("rangeInvalid") : t("validityHint")}
          </span>
        </SheetSection>

        <SheetSection title={t("photo")}>
          <PhotoInput value={photo} onChange={setPhoto} />
        </SheetSection>

        <SheetSection title={t("notes")}>
          <Textarea
            aria-label={t("notes")}
            value={notes}
            maxLength={1000}
            onChange={(e) => setNotes(e.target.value)}
          />
        </SheetSection>
      </form>
    </DetailDrawer>
  );
}
