import { Badge } from "@vms/ui";
import { useFormatter, useTranslations } from "next-intl";
import type { VisitRequestDetail } from "@/data/visits/visits.api";
import { Field, durationHms } from "../helpers";
import { SheetSection } from "./SheetSection";

/**
 * The Visit Summary grid. Its fields are dynamic: on-site/checked-out visits add
 * check-in/out times + operatives; VMC/admin viewers get the request origin
 * (source, staff role, created-by, time created).
 */
export function VisitSummarySection({
  data,
  isVmcOrAdmin,
  showHostCard,
  currentUserId,
}: {
  data: VisitRequestDetail;
  isVmcOrAdmin: boolean;
  showHostCard: boolean;
  currentUserId?: string;
}) {
  const t = useTranslations("requests");
  const format = useFormatter();
  const onsite = data.status === "CHECKED_IN";
  const checkedOut = data.status === "CHECKED_OUT";
  const fmt = (iso: string) =>
    format.dateTime(new Date(iso), {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <SheetSection title={t("sections.visitSummary")}>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t("sections.purposeCategory")}>
          <Badge intent="neutral" tone="soft">
            {data.purpose}
          </Badge>
        </Field>

        {checkedOut && data.checkInAt && data.checkOutAt ? (
          <Field label={t("sections.timeSpentOnsite")}>
            {`${durationHms(data.checkInAt, data.checkOutAt)} HR`}
          </Field>
        ) : data.scheduledAt ? (
          <Field label={t("sections.scheduledFor")}>
            {fmt(data.scheduledAt)}
          </Field>
        ) : null}

        {(onsite || checkedOut) && data.checkInAt ? (
          <Field
            label={
              checkedOut
                ? t("sections.checkInTime")
                : t("sections.checkInDateTime")
            }
          >
            {fmt(data.checkInAt)}
          </Field>
        ) : null}

        {checkedOut && data.checkOutAt ? (
          <Field label={t("sections.checkOutDateTime")}>
            {fmt(data.checkOutAt)}
          </Field>
        ) : null}

        {onsite ? (
          <Field label={t("sections.checkedInBy")}>
            {data.checkedInByName ?? "—"}
          </Field>
        ) : null}
        {checkedOut ? (
          <Field label={t("sections.checkedOutBy")}>
            {data.checkedOutByName ?? "—"}
          </Field>
        ) : null}

        {!showHostCard ? (
          <Field label={t("sections.visitingFloor")}>{data.floor ?? "—"}</Field>
        ) : null}

        {!checkedOut ? (
          <Field label={t("sections.guestPass")}>
            {data.pass?.cardNumber ? (
              <span className="font-semibold text-warning">
                {data.pass.cardNumber}
              </span>
            ) : (
              t("notAssigned")
            )}
          </Field>
        ) : null}

        {isVmcOrAdmin ? (
          <>
            <Field label={t("sections.source")}>{data.source ?? "—"}</Field>
            <Field label={t("sections.staffRole")}>
              {data.host?.department ?? "—"}
            </Field>
            <Field label={t("sections.createdByLabel")}>
              {data.createdByName
                ? data.createdById === currentUserId
                  ? `${data.createdByName} ${t("createdByYou")}`
                  : data.createdByName
                : "—"}
            </Field>
            <Field label={t("sections.timeCreated")}>
              {fmt(data.createdAt)}
            </Field>
          </>
        ) : null}
      </div>
    </SheetSection>
  );
}
