"use client";

import { PERMISSIONS } from "@vms/contracts";
import { Button, DetailDrawer, DetailSection, Spinner } from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";
import { CheckInModal } from "@/app/[locale]/dashboard/_components/checkin/CheckInModal";
import { CheckOutModal } from "@/app/[locale]/dashboard/_components/checkin/CheckOutModal";
import {
  useAlert,
  useApproveVisit,
  useCancelVisit,
  useDenyVisit,
  useFlagVisit,
  useRequestInfo,
  useResolveAlert,
  useResubmitVisit,
  useVisitRequest,
} from "@/data/requests/queries";
import type { VisitRequestDetail } from "@/data/visits/visits.api";
import { useAuth } from "@/shared/auth/AuthContext";
import { EditVisitForm } from "./visit-detail/forms/EditVisitForm";
import {
  DenyForm,
  FlagForm,
  RequestInfoForm,
} from "./visit-detail/forms/forms";
import { AlertStripe } from "./visit-detail/sections/AlertStripe";
import { AlertSummarySection } from "./visit-detail/sections/AlertSummarySection";
import { GuestInformationSection } from "./visit-detail/sections/GuestInformationSection";
import { HostUnitFloorSection } from "./visit-detail/sections/HostUnitFloorSection";
import { NotesSection } from "./visit-detail/sections/NotesSection";
import { NotificationBanner } from "./visit-detail/sections/NotificationBanner";
import { NotificationsSection } from "./visit-detail/sections/NotificationsSection";
import { RateGuestSection } from "./visit-detail/sections/RateGuestSection";
import { VisitProgressSection } from "./visit-detail/sections/VisitProgressSection";
import { VisitSummarySection } from "./visit-detail/sections/VisitSummarySection";
import { useVisitDetailModel } from "./visit-detail/useVisitDetailModel";

export type { SelectedItem, NotificationContext } from "./visit-detail/types";
import type { NotificationContext } from "./visit-detail/types";

type ActiveForm = "deny" | "flag" | "requestInfo" | null;

function VisitDetailBody({
  data,
  onClose,
  notification,
  initialForm = null,
}: {
  data: VisitRequestDetail;
  onClose: () => void;
  notification?: NotificationContext;
  initialForm?: "deny" | null;
}) {
  const t = useTranslations("requests");
  const { user, hasPermission } = useAuth();
  const m = useVisitDetailModel(data);
  const canSeeDeliveries = hasPermission(PERMISSIONS.NOTIFICATION_READ);

  const [activeForm, setActiveForm] = React.useState<ActiveForm>(initialForm);
  const [editing, setEditing] = React.useState(false);
  const [checkAction, setCheckAction] = React.useState<"in" | "out" | null>(
    null,
  );

  const approve = useApproveVisit(data.id);
  const deny = useDenyVisit(data.id);
  const flag = useFlagVisit(data.id);
  const requestInfo = useRequestInfo(data.id);
  const resolveAlert = useResolveAlert(data.id);
  const resubmit = useResubmitVisit(data.id);
  const cancel = useCancelVisit(data.id);

  const toggle = (f: ActiveForm) =>
    setActiveForm((cur) => (cur === f ? null : f));

  const footer = m.hasActions ? (
    <>
      {m.canResubmit ? (
        <Button
          intent="primary"
          size="sm"
          onClick={() => resubmit.mutate({})}
          disabled={resubmit.isPending}
        >
          {t("actions.resubmit")}
        </Button>
      ) : null}
      {m.canApprove ? (
        <Button
          intent="success"
          size="sm"
          onClick={() => approve.mutate()}
          disabled={approve.isPending}
        >
          {t("actions.approve")}
        </Button>
      ) : null}
      {m.canDeny ? (
        <Button
          intent="danger"
          tone="outline"
          size="sm"
          onClick={() => toggle("deny")}
        >
          {t("actions.deny")}
        </Button>
      ) : null}
      {m.canRequestInfo ? (
        <Button
          intent="warning"
          tone="outline"
          size="sm"
          onClick={() => toggle("requestInfo")}
        >
          {t("actions.requestInfo")}
        </Button>
      ) : null}
      {m.canFlag ? (
        <Button
          intent="danger"
          tone="outline"
          size="sm"
          onClick={() => toggle("flag")}
        >
          {t("actions.flag")}
        </Button>
      ) : null}
      {m.canResolveAlert && m.activeAlert ? (
        <Button
          intent="success"
          size="sm"
          onClick={() =>
            resolveAlert.mutate({
              alertId: m.activeAlert!.id,
              status: "RESOLVED",
            })
          }
          disabled={resolveAlert.isPending}
        >
          {t("actions.resolve")}
        </Button>
      ) : null}
      {m.canCancel ? (
        <Button
          intent="danger"
          tone="outline"
          size="sm"
          onClick={() => cancel.mutate()}
          disabled={cancel.isPending}
        >
          {t("actions.cancelRequest")}
        </Button>
      ) : null}
      {m.canEdit ? (
        <Button intent="primary" size="sm" onClick={() => setEditing(true)}>
          {t("actions.editRequest")}
        </Button>
      ) : null}
      {m.canCheckIn ? (
        <Button intent="primary" size="sm" onClick={() => setCheckAction("in")}>
          {t("actions.checkIn")}
        </Button>
      ) : null}
      {m.canCheckOut ? (
        <Button intent="danger" size="sm" onClick={() => setCheckAction("out")}>
          {t("actions.checkOut")}
        </Button>
      ) : null}
    </>
  ) : undefined;

  const formCard = "rounded-xl border border-border bg-surface p-4";

  return (
    <>
      <DetailDrawer
        open
        side="start"
        onOpenChange={(o) => !o && onClose()}
        title={editing ? t("editTitle") : t("detailTitle")}
        footer={editing ? undefined : footer}
      >
        {editing ? (
          <EditVisitForm detail={data} onDone={() => setEditing(false)} />
        ) : (
          <>
            {notification ? <NotificationBanner ctx={notification} /> : null}
            {m.hasAlert && m.activeAlert ? (
              <AlertStripe alert={m.activeAlert} />
            ) : null}

            {activeForm === "deny" ? (
              <DetailSection title={t("actions.deny")} className={formCard}>
                <DenyForm
                  pending={deny.isPending}
                  onCancel={() => setActiveForm(null)}
                  onSubmit={(reason) =>
                    deny.mutate(reason, {
                      onSuccess: () => setActiveForm(null),
                    })
                  }
                />
              </DetailSection>
            ) : null}
            {activeForm === "requestInfo" ? (
              <DetailSection
                title={t("actions.requestInfo")}
                className={formCard}
              >
                <RequestInfoForm
                  pending={requestInfo.isPending}
                  onCancel={() => setActiveForm(null)}
                  onSubmit={(reason) =>
                    requestInfo.mutate(
                      { reason },
                      { onSuccess: () => setActiveForm(null) },
                    )
                  }
                />
              </DetailSection>
            ) : null}
            {activeForm === "flag" ? (
              <DetailSection title={t("actions.flag")} className={formCard}>
                <FlagForm
                  pending={flag.isPending}
                  onCancel={() => setActiveForm(null)}
                  onSubmit={(input) =>
                    flag.mutate(input, { onSuccess: () => setActiveForm(null) })
                  }
                />
              </DetailSection>
            ) : null}

            {m.showHostCard ? <HostUnitFloorSection data={data} /> : null}
            <GuestInformationSection data={data} hasAlert={m.hasAlert} />
            {m.showProgress ? (
              <VisitProgressSection
                data={data}
                variant={m.isStaff ? "staff" : "vmc"}
                showQr={m.showQr}
              />
            ) : null}
            <VisitSummarySection
              data={data}
              isVmcOrAdmin={m.isVmc || m.isAdmin}
              showHostCard={m.showHostCard}
              currentUserId={user?.id}
            />
            {canSeeDeliveries ? (
              <NotificationsSection visitId={data.id} />
            ) : null}
            {m.hasAlert && m.activeAlert ? (
              <AlertSummarySection data={data} alert={m.activeAlert} />
            ) : null}
            {m.showRating ? <RateGuestSection visitId={data.id} /> : null}
            {!m.hasAlert ? <NotesSection data={data} /> : null}
          </>
        )}
      </DetailDrawer>

      {checkAction === "in" ? (
        <CheckInModal visitId={data.id} onClose={() => setCheckAction(null)} />
      ) : null}
      {checkAction === "out" ? (
        <CheckOutModal visitId={data.id} onClose={() => setCheckAction(null)} />
      ) : null}
    </>
  );
}

function LoadingDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations("requests");
  return (
    <DetailDrawer
      open
      side="start"
      onOpenChange={(o) => !o && onClose()}
      title={t("detailTitle")}
    >
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    </DetailDrawer>
  );
}

/** Opening an alert resolves its visit and renders the same sheet with the alert stripe. */
export function VisitDetailSheet({
  kind,
  id,
  onClose,
  notification,
  initialForm,
}: {
  kind: "request" | "alert";
  id: string;
  onClose: () => void;
  notification?: NotificationContext;
  /** Open with the deny form expanded; Approve opens as-is so the decision is made from the details. */
  initialForm?: "deny" | null;
}) {
  const isAlert = kind === "alert";
  // An alert id resolves to its visit; a request id is the visit id directly.
  const alert = useAlert(isAlert ? id : null);
  const visitId = isAlert ? (alert.data?.visitId ?? null) : id;
  const request = useVisitRequest(visitId);

  if (isAlert && (alert.isLoading || !alert.data))
    return <LoadingDrawer onClose={onClose} />;
  if (!visitId || request.isLoading || !request.data)
    return <LoadingDrawer onClose={onClose} />;

  return (
    <VisitDetailBody
      data={request.data}
      onClose={onClose}
      notification={notification}
      initialForm={initialForm}
    />
  );
}
