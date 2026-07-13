import { Badge } from "@vms/ui";
import { useFormatter, useTranslations } from "next-intl";
import type { VisitAlert, VisitRequestDetail } from "@/data/visits/visits.api";
import { LEVEL_DOT } from "../helpers";
import { NoteComposer, NoteList } from "./notes";
import { SheetSection } from "./SheetSection";

/**
 * Alert Summary: risk level, category and flagged-at, the alert reason, and the
 * notes/remarks thread. When shown it replaces the generic Notes section (the
 * conversation lives here). Notes attach to the visit — one thread per visit.
 */
export function AlertSummarySection({
  data,
  alert,
}: {
  data: VisitRequestDetail;
  alert: VisitAlert;
}) {
  const t = useTranslations("requests");
  const format = useFormatter();
  return (
    <SheetSection title={t("sections.alertSummary")}>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-fg-subtle">
            {t("sections.riskLevel")}
          </span>
          <span className="flex items-center gap-2 font-semibold text-fg">
            <span
              className={`size-2 rounded-full ${LEVEL_DOT[alert.level] ?? "bg-fg-muted"}`}
              aria-hidden="true"
            />
            {alert.level}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-fg-subtle">
            {t("sections.alertCategory")}
          </span>
          <Badge intent="warning" tone="soft">
            {alert.category ?? t("alertDefaultCategory")}
          </Badge>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-fg-subtle">
            {t("sections.flaggedAt")}
          </span>
          <span className="text-fg">
            {format.dateTime(new Date(alert.createdAt), {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-fg-subtle">
          {t("sections.alertReason")}
        </span>
        <div className="rounded-lg bg-danger-subtle p-4 text-sm text-fg">
          {alert.reason}
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <NoteList notes={data.notes} emptyLabel={t("noNotes")} />
        <NoteComposer
          target={{ visitId: data.id }}
          placeholder={t("respondPlaceholder")}
        />
      </div>
    </SheetSection>
  );
}
