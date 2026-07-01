"use client";

import type { HostOption } from "@vms/contracts";
import { ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import {
  formatPhone,
  scheduledAtOf,
  type GuestEntry,
  type VisitFormMode,
} from "./guest-form";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-1">
      <span className="text-xs uppercase tracking-wide text-fg-subtle">
        {label}
      </span>
      <span className="font-medium text-fg">{value || "—"}</span>
    </div>
  );
}

function CardHeader({
  title,
  onPrev,
  onNext,
  showNav,
}: {
  title: string;
  onPrev?: () => void;
  onNext?: () => void;
  showNav?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-primary-subtle px-4 py-3">
      <span className="font-semibold text-primary">{title}</span>
      {showNav ? (
        <div className="flex items-center gap-3 text-primary">
          <button type="button" aria-label="Previous guest" onClick={onPrev}>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Next guest" onClick={onNext}>
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ConfirmStep({
  guests,
  mode,
  hosts,
}: {
  guests: GuestEntry[];
  mode: VisitFormMode;
  hosts: HostOption[];
}) {
  const t = useTranslations("invite");
  const format = useFormatter();
  const [idx, setIdx] = React.useState(0);
  const guest = guests[idx] ?? guests[0];
  // Each guest carries its own visit details now.
  const source = guest;
  const hostName =
    hosts.find((h) => h.userId === source.hostUserId)?.fullName ?? "";
  const scheduled = scheduledAtOf(source);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-full border border-border text-fg-muted">
          <HelpCircle className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-semibold text-fg">{t("confirm.title")}</h2>
        <p className="text-sm text-fg-muted">{t("confirm.subtitle")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <CardHeader
          title={t("confirm.guestDetails")}
          showNav={guests.length > 1}
          onPrev={() => setIdx((i) => (i - 1 + guests.length) % guests.length)}
          onNext={() => setIdx((i) => (i + 1) % guests.length)}
        />
        <Row label={t("confirm.fullName")} value={guest.fullName} />
        <Row label={t("confirm.email")} value={guest.email} />
        <Row label={t("confirm.phone")} value={formatPhone(guest)} />
        <Row label={t("confirm.organization")} value={guest.organization} />
      </div>

      <div className="flex flex-col gap-2">
        <CardHeader title={t("confirm.visitDetails")} />
        {mode === "invite" ? (
          <Row label={t("confirm.host")} value={hostName} />
        ) : null}
        <Row label={t("confirm.floor")} value={source.floor} />
        <Row label={t("confirm.purpose")} value={source.purpose} />
        {mode === "invite" ? (
          <Row
            label={t("confirm.dateTime")}
            value={
              scheduled
                ? format.dateTime(scheduled, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "—"
            }
          />
        ) : null}
        <Row label={t("confirm.notes")} value={source.notes} />
      </div>
    </div>
  );
}
