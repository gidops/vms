import { Avatar, Badge } from "@vms/ui";
import { useTranslations } from "next-intl";
import { useEvacuationAssistText } from "../../EvacuationAssist";
import type { VisitRequestDetail } from "@/data/visits/visits.api";
import type { VisitStatus } from "../helpers";
import { SheetSection } from "./SheetSection";

const PILL_INTENT: Record<
  VisitStatus,
  "warning" | "success" | "danger" | "neutral"
> = {
  PENDING: "warning",
  REVIEW_REQUESTED: "danger",
  FLAGGED: "danger",
  APPROVED: "success",
  DENIED: "danger",
  CHECKED_IN: "success",
  CHECKED_OUT: "neutral",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
};

/** Guest identity card + a status pill (or "Needs Attention" when an alert is open). */
export function GuestInformationSection({
  data,
  hasAlert,
}: {
  data: VisitRequestDetail;
  hasAlert: boolean;
}) {
  const t = useTranslations("requests");
  const assistText = useEvacuationAssistText();
  const { visitor } = data;
  return (
    <SheetSection title={t("sections.visitorInfo")}>
      <div className="flex items-start justify-between gap-3 rounded-lg bg-surface-muted p-4">
        <div className="flex items-center gap-3">
          <Avatar name={visitor.fullName} size="md" />
          <div className="flex flex-col">
            <span className="font-medium text-fg">{visitor.fullName}</span>
            {visitor.organization ? (
              <span className="text-sm text-fg-muted">
                {visitor.organization}
              </span>
            ) : null}
            <span className="text-sm text-fg-muted">
              {visitor.email}
              {visitor.phone ? ` · ${visitor.phone}` : ""}
            </span>
            <span className="text-sm text-fg-muted">
              {t("evacuationAssist")}:{" "}
              <span
                className={
                  data.needsEvacuationAssist
                    ? "font-semibold text-warning"
                    : "font-medium text-fg"
                }
              >
                {data.needsEvacuationAssist == null
                  ? t("notAsked")
                  : data.needsEvacuationAssist
                    ? t("yes")
                    : t("no")}
              </span>
              {data.needsEvacuationAssist &&
              data.evacuationAssistTypes?.length ? (
                <span className="text-fg">
                  {" · "}
                  {assistText(
                    data.evacuationAssistTypes,
                    data.evacuationAssistOther,
                  )}
                </span>
              ) : null}
            </span>
          </div>
        </div>
        {hasAlert ? (
          <Badge intent="danger" tone="soft">
            {t("alertNeedsAttention")}
          </Badge>
        ) : (
          <Badge intent={PILL_INTENT[data.status]} tone="soft">
            {t(`pill.${data.status}`)}
          </Badge>
        )}
      </div>
    </SheetSection>
  );
}
