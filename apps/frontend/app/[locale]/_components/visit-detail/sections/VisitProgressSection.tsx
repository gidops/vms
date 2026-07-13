import { Timeline } from "@vms/ui";
import { useTranslations } from "next-intl";
import { useResendCode } from "@/data/requests/queries";
import type { VisitRequestDetail } from "@/data/visits/visits.api";
import { timelineFor } from "../helpers";
import { SheetSection } from "./SheetSection";

/** QR + invite reference code + "Send CODE to guest" (staff, pre-check-in only). */
function QrPanel({
  visitId,
  qrCode,
  referenceCode,
}: {
  visitId: string;
  qrCode?: string | null;
  referenceCode?: string | null;
}) {
  const t = useTranslations("requests");
  const resend = useResendCode(visitId);
  if (!qrCode && !referenceCode) return null;
  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      {qrCode ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrCode}
          alt=""
          className="size-28 rounded-md"
          aria-hidden="true"
        />
      ) : null}
      {referenceCode ? (
        <span className="rounded-md bg-accent px-3 py-1.5 text-center font-mono text-sm font-semibold tracking-[0.25em] text-accent-fg">
          {referenceCode}
        </span>
      ) : null}
      {referenceCode ? (
        <button
          type="button"
          onClick={() => resend.mutate()}
          disabled={resend.isPending}
          className="text-xs font-medium text-primary underline disabled:opacity-50"
        >
          {resend.isSuccess ? t("codeSent") : t("sendCode")}
        </button>
      ) : null}
    </div>
  );
}

/** The gold destination card shown once on-site (floor in a square). */
function DestinationCard({ floor }: { floor?: string | null }) {
  const t = useTranslations("requests");
  if (!floor) return null;
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div className="flex size-28 items-center justify-center rounded-md bg-accent p-3 text-center text-sm font-bold text-accent-fg">
        {floor}
      </div>
      <span className="text-xs uppercase tracking-wide text-fg-subtle">
        {t("sections.destination")}
      </span>
    </div>
  );
}

/**
 * The track-progress stepper with a role-aware side panel: staff see the QR +
 * send-code before check-in, everyone sees the destination card once on-site.
 */
export function VisitProgressSection({
  data,
  variant,
  showQr,
}: {
  data: VisitRequestDetail;
  variant: "staff" | "vmc";
  showQr: boolean;
}) {
  const t = useTranslations("requests");
  const labels = {
    gateValidated: t("timeline.gateValidated"),
    inviteCreated: t("timeline.inviteCreated"),
    awaitingSm: t("timeline.awaitingSm"),
    checkedIn: t("timeline.checkedIn"),
    passIssued: t("timeline.issuedPass"),
    checkedOut: t("timeline.checkedOut"),
  };
  const onsite = data.status === "CHECKED_IN" || data.status === "CHECKED_OUT";
  const title =
    variant === "vmc"
      ? t("sections.trackRequestStatus")
      : t("sections.trackStatus");

  return (
    <SheetSection title={title}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Timeline steps={timelineFor(data.status, labels, variant)} />
        </div>
        {showQr ? (
          <QrPanel
            visitId={data.id}
            qrCode={data.qrCode}
            referenceCode={data.referenceCode}
          />
        ) : onsite ? (
          <DestinationCard floor={data.floor} />
        ) : null}
      </div>
    </SheetSection>
  );
}
