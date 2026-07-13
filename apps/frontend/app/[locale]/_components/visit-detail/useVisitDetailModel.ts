import * as React from "react";
import type { VisitAlert, VisitRequestDetail } from "@/data/visits/visits.api";
import { useAuth } from "@/shared/auth/AuthContext";
import { TERMINAL } from "./helpers";

/** Alert types that constitute a security hold (block check-in). */
const SECURITY_TYPES = ["SECURITY_REVIEW", "RESTRICTED_MATCH"];

export interface VisitDetailModel {
  /** The active viewer's role bucket, driving layout (QR vs Host card, etc.). */
  isStaff: boolean;
  isVmc: boolean;
  isAdmin: boolean;
  /** The staff host viewing their own visit — gets the guest-first layout. */
  viewerIsHost: boolean;
  isMine: boolean;
  onsite: boolean;
  checkedOut: boolean;
  isTerminal: boolean;
  /** The open alert driving the stripe + Alert Summary (security takes priority). */
  activeAlert: VisitAlert | null;
  hasAlert: boolean;
  hasSecurityHold: boolean;
  /** Footer action gates. */
  canApprove: boolean;
  canDeny: boolean;
  canFlag: boolean;
  canRequestInfo: boolean;
  canResolveAlert: boolean;
  canResubmit: boolean;
  canCancel: boolean;
  canEdit: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  hasActions: boolean;
  /** Section visibility. */
  showProgress: boolean;
  showQr: boolean;
  showRating: boolean;
  showHostCard: boolean;
}

/** Derive everything the sheet's sections + footer need from the visit + auth. */
export function useVisitDetailModel(
  data: VisitRequestDetail,
): VisitDetailModel {
  const { hasPermission, user, activeRole } = useAuth();

  return React.useMemo(() => {
    const isStaff = activeRole === "STAFF";
    const isAdmin = activeRole === "ADMIN" || activeRole === "SUPER_ADMIN";
    const isVmc = activeRole === "VMC";

    const status = data.status;
    const isTerminal = TERMINAL.includes(status);
    const isMine = data.createdById === user?.id;
    const viewerIsHost = data.host?.user.id === user?.id;
    const onsite = status === "CHECKED_IN";
    const checkedOut = status === "CHECKED_OUT";

    const openAlerts = (data.alerts ?? []).filter((a) => a.status === "OPEN");
    const securityAlert =
      openAlerts.find((a) => SECURITY_TYPES.includes(a.type)) ?? null;
    const infoAlert =
      openAlerts.find((a) => a.type === "ADDITIONAL_INFO") ?? null;
    const activeAlert = securityAlert ?? infoAlert;
    const hasAlert = !!activeAlert;
    const hasSecurityHold = !!securityAlert || status === "FLAGGED";

    const isPending = status === "PENDING";
    const preApproval = status === "PENDING" || status === "REVIEW_REQUESTED";

    const canApprove = isPending && hasPermission("visit:approve");
    const canDeny = isPending && hasPermission("visit:deny");
    const canFlag =
      hasPermission("visit:flag") && !isTerminal && status !== "FLAGGED";
    const canRequestInfo =
      hasPermission("visit:request_info") &&
      !isTerminal &&
      status !== "REVIEW_REQUESTED";
    const canResolveAlert = hasAlert && hasPermission("alert:resolve");
    const canResubmit =
      status === "REVIEW_REQUESTED" && data.host?.user.id === user?.id;
    const canCancel = data.source === "VMC_STATION" && isMine && !isTerminal;
    const canEdit = isMine && preApproval;
    const canCheckIn =
      status === "APPROVED" &&
      hasPermission("visit:check_in") &&
      !hasSecurityHold;
    const canCheckOut =
      status === "CHECKED_IN" && hasPermission("visit:check_out");

    const hasActions =
      canApprove ||
      canDeny ||
      canFlag ||
      canRequestInfo ||
      canResolveAlert ||
      canResubmit ||
      canCancel ||
      canEdit ||
      canCheckIn ||
      canCheckOut;

    // An open security alert takes over the sheet: the stripe + Alert Summary
    // replace the progress stepper and the generic notes section.
    const showProgress = !hasAlert;
    const showQr = isStaff && !onsite && !checkedOut && !hasAlert;
    const showRating =
      checkedOut &&
      ((isStaff && data.type === "PRE_INVITED") ||
        (isVmc && data.type === "WALK_IN"));
    const showHostCard = (isVmc || isAdmin) && !viewerIsHost;

    return {
      isStaff,
      isVmc,
      isAdmin,
      viewerIsHost,
      isMine,
      onsite,
      checkedOut,
      isTerminal,
      activeAlert,
      hasAlert,
      hasSecurityHold,
      canApprove,
      canDeny,
      canFlag,
      canRequestInfo,
      canResolveAlert,
      canResubmit,
      canCancel,
      canEdit,
      canCheckIn,
      canCheckOut,
      hasActions,
      showProgress,
      showQr,
      showRating,
      showHostCard,
    };
  }, [data, hasPermission, user, activeRole]);
}
