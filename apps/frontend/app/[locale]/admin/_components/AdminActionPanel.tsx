"use client";

import { PERMISSIONS } from "@vms/contracts";
import { Button } from "@vms/ui";
import { useTranslations } from "next-intl";
import {
  EvacuationRollLink,
  useEvacuationAlertCount,
} from "@/app/[locale]/_components/EvacuationIndicator";
import {
  PANEL_ACTION,
  PANEL_ACTIONS,
  PanelActionLabel,
} from "@/app/[locale]/_components/OverviewBar";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";
import { adminConsoleRole } from "@/shared/auth/adminConsoleRole";

/** Two permission-gated actions per console, falling back to "View Activity" so the panel is never empty. */
export function AdminActionPanel({
  onAddVisitor,
}: {
  onAddVisitor: () => void;
}) {
  const t = useTranslations("adminV2.panel");
  const tQa = useTranslations("admin.overview.quickActions");
  const router = useRouter();
  const { hasPermission } = useAuth();
  const evacuationCount = useEvacuationAlertCount();

  const canAdd = hasPermission(PERMISSIONS.INVITATION_CREATE);
  const canApprove = hasPermission(PERMISSIONS.VISIT_APPROVE);
  const canHistory = hasPermission(PERMISSIONS.HISTORY_READ);
  const sm = adminConsoleRole(hasPermission) === "securityManager";
  // The System Admin approves too, just not as a primary duty.
  const review = () => router.push("/admin/approvals");

  const actions: {
    key: string;
    label: string;
    short: string;
    onClick: () => void;
  }[] = (
    sm
      ? [
          {
            key: "review",
            label: t("reviewCta"),
            short: t("reviewCtaShort"),
            onClick: review,
            show: true,
          },
          {
            key: "history",
            label: t("historyCta"),
            short: t("historyCtaShort"),
            onClick: () =>
              router.push({ pathname: "/insights", query: { tab: "history" } }),
            show: canHistory,
          },
        ]
      : [
          {
            key: "add",
            label: tQa("addVisitor"),
            short: tQa("addVisitorShort"),
            onClick: onAddVisitor,
            show: canAdd,
          },
          {
            key: "review",
            label: t("reviewCta"),
            short: t("reviewCtaShort"),
            onClick: review,
            show: canApprove,
          },
        ]
  ).filter((a) => a.show);
  const empty = actions.length === 0;

  return (
    <>
      <div className="relative flex flex-col gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/afreximbank.svg"
          alt=""
          className="size-12"
          aria-hidden="true"
        />
        <h3 className="whitespace-pre-line text-lg font-semibold">
          {empty ? t("activityTitle") : tQa("title")}
        </h3>
        <EvacuationRollLink count={evacuationCount} />
      </div>
      <div className={PANEL_ACTIONS}>
        {empty ? (
          <Button
            intent="accent"
            className={PANEL_ACTION}
            onClick={() => router.push("/admin/requests")}
          >
            {t("activityCta")}
          </Button>
        ) : (
          actions.map((a, i) => (
            <Button
              key={a.key}
              intent={i === 0 ? "primary" : "accent"}
              className={PANEL_ACTION}
              aria-label={a.label}
              onClick={a.onClick}
            >
              <PanelActionLabel label={a.label} short={a.short} />
            </Button>
          ))
        )}
      </div>
    </>
  );
}
