"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Spinner,
} from "@vms/ui";
import { Check } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { useCheckIn, useVisitRequest } from "@/data/requests/queries";
import type { VisitRequestDetail } from "@/data/visits/visits.api";
import { AssignPass } from "./AssignPass";
import { QrPane, statusText, SummaryRow } from "./modal-shared";

export function CheckInModal({
  visitId,
  onClose,
}: {
  visitId: string;
  onClose: () => void;
}) {
  const t = useTranslations("checkin");
  const format = useFormatter();
  const detailQ = useVisitRequest(visitId);
  const checkIn = useCheckIn(visitId);
  const [cardId, setCardId] = React.useState("");
  const [done, setDone] = React.useState<VisitRequestDetail | null>(null);

  const visit = detailQ.data;
  const invited = visit ? visit.type !== "WALK_IN" : false;

  async function complete() {
    if (!cardId) return;
    try {
      const result = await checkIn.mutateAsync({ accessCardId: cardId });
      setDone(result);
    } catch {
      /* surfaced below */
    }
  }

  const right = (() => {
    if (!visit) {
      return (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      );
    }
    if (done) {
      return (
        <div className="flex flex-col items-center gap-5 py-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full border-2 border-success text-success">
            <Check className="size-6" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold text-fg">
              {t("successTitle")}
            </h2>
            <p className="text-sm text-fg-muted">{t("successSubtitle")}</p>
          </div>
          <span className="rounded-lg bg-surface-muted px-6 py-2 text-xl font-bold tracking-[0.3em] text-fg">
            {done.pass?.cardNumber ?? "—"}
          </span>
          <Button intent="primary" fullWidth onClick={onClose}>
            {t("backToDashboard")}
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-2 text-center">
          {invited ? (
            <Badge
              intent={visit.gateValidatedAt ? "success" : "warning"}
              tone="soft"
            >
              {visit.gateValidatedAt ? t("gateDone") : t("gatePending")}
            </Badge>
          ) : null}
          <h2 className="text-xl font-semibold text-primary">
            {t("confirmTitle")}
          </h2>
          <p className="text-sm text-fg-muted">{t("confirmSubtitle")}</p>
        </div>

        <AssignPass value={cardId} onChange={setCardId} />

        <div className="rounded-lg bg-surface-muted/60 px-4">
          <SummaryRow label={t("guestName")} value={visit.visitor.fullName} />
          <SummaryRow
            label={t("host")}
            value={visit.host?.user.fullName ?? "—"}
          />
          <SummaryRow label={t("purpose")} value={visit.purpose} />
          <SummaryRow
            label={t("schedule")}
            value={
              visit.scheduledAt
                ? format.dateTime(new Date(visit.scheduledAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "—"
            }
          />
          <SummaryRow
            label={t("status")}
            value={statusText(visit.status)}
            accent="success"
          />
        </div>

        {checkIn.isError ? (
          <p className="text-sm text-danger">{t("error")}</p>
        ) : null}

        <Button
          intent="primary"
          fullWidth
          disabled={!cardId || checkIn.isPending}
          onClick={complete}
        >
          {t("complete")}
        </Button>
      </div>
    );
  })();

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
              qrCode={visit?.qrCode}
              code={visit?.referenceCode}
              hint={t("checkInHint")}
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
