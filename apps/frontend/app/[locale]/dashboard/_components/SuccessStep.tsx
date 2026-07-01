"use client";

import { Button } from "@vms/ui";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import type { VisitRequestDetail } from "@/data/visits/visits.api";
import type { VisitFormMode } from "./guest-form";

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-fg-muted">{label}</span>
      <span className="text-right font-semibold text-fg">{value || "—"}</span>
    </div>
  );
}

/**
 * Post-create success screen. Invites show a per-guest QR + invite code carousel;
 * walk-ins show the summary plus a "Check-In Visitor" action. Both render the
 * teal-topped summary card from the design.
 */
export function SuccessStep({
  created,
  mode,
  onCheckIn,
}: {
  created: VisitRequestDetail[];
  mode: VisitFormMode;
  onCheckIn?: () => void;
}) {
  const t = useTranslations("invite");
  const format = useFormatter();
  const [idx, setIdx] = React.useState(0);
  const visit = created[idx] ?? created[0];
  const isInvite = mode === "invite";
  const scheduled = visit.scheduledAt ? new Date(visit.scheduledAt) : null;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-full border-2 border-success text-success">
          <Check className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-semibold text-fg">{t("success.title")}</h2>
        <p className="text-sm text-fg-muted">{t("success.subtitle")}</p>
      </div>

      {isInvite && visit.qrCode ? (
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={visit.qrCode}
            alt={`QR for ${visit.visitor.fullName}`}
            className="size-44 rounded-lg border border-border p-2"
          />
          <div className="flex items-center gap-4">
            {created.length > 1 ? (
              <button
                type="button"
                aria-label="Previous guest"
                onClick={() =>
                  setIdx((i) => (i - 1 + created.length) % created.length)
                }
                className="text-fg-muted"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
            ) : null}
            <span className="rounded-lg bg-surface-muted px-6 py-2 text-2xl font-bold tracking-[0.3em] text-fg">
              {visit.referenceCode}
            </span>
            {created.length > 1 ? (
              <button
                type="button"
                aria-label="Next guest"
                onClick={() => setIdx((i) => (i + 1) % created.length)}
                className="text-fg-muted"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="w-full rounded-lg border-t-2 border-primary bg-primary-subtle/40 p-4">
        <SummaryRow
          label={t("success.guestsName")}
          value={visit.visitor.fullName}
        />
        <SummaryRow
          label={t("success.host")}
          value={visit.host?.user.fullName ?? "—"}
        />
        <SummaryRow label={t("success.purpose")} value={visit.purpose} />
        <SummaryRow
          label={t("success.schedule")}
          value={
            scheduled
              ? format.dateTime(scheduled, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "—"
          }
        />
        <SummaryRow label={t("success.floor")} value={visit.floor ?? "—"} />
      </div>

      {!isInvite ? (
        <Button type="button" intent="primary" fullWidth onClick={onCheckIn}>
          {t("success.checkInVisitor")}
        </Button>
      ) : null}
    </div>
  );
}
