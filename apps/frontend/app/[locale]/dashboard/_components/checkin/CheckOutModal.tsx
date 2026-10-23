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
import { useTranslations } from "next-intl";
import * as React from "react";
import { useCheckOut, useVisitRequest } from "@/data/requests/queries";
import { AssignPass } from "./AssignPass";
import { formatDuration, QrPane, statusText, SummaryRow } from "./modal-shared";

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

  async function complete() {
    try {
      await checkOut.mutateAsync(cardId ? { accessCardId: cardId } : {});
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

      {checkOut.isError ? (
        <p className="text-sm text-danger">{t("error")}</p>
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
