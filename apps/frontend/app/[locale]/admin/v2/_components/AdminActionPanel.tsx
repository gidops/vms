"use client";

import { PERMISSIONS } from "@vms/contracts";
import { Button } from "@vms/ui";
import { useTranslations } from "next-intl";
import {
  EvacuationRollLink,
  useEvacuationAlertCount,
} from "@/app/[locale]/_components/EvacuationIndicator";
import { DecorChevrons } from "@/app/[locale]/_components/OverviewBar";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";
import { adminConsoleRole } from "@/shared/auth/adminConsoleRole";

/**
 * The brand-green quick-actions content of the overview band (VMC
 * `QuickActions` / staff `BookPanel`): two buttons picked for the console.
 * Security Manager: Review Requests + Visit History (Insights → History).
 * System Admin: Add Visitor + Review Requests. Each is permission-gated; a
 * role with neither gets a single "View Activity" into the Requests tab, so
 * the panel is never empty.
 */
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
  // Review Requests opens the approval queue for every approver (the System
  // Admin approves too, just not as a primary duty).
  const review = () => router.push("/admin/v2/approvals");

  const actions: { key: string; label: string; onClick: () => void }[] = (
    sm
      ? [
          { key: "review", label: t("reviewCta"), onClick: review, show: true },
          {
            key: "history",
            label: t("historyCta"),
            onClick: () =>
              router.push({ pathname: "/insights", query: { tab: "history" } }),
            show: canHistory,
          },
        ]
      : [
          {
            key: "add",
            label: tQa("addVisitor"),
            onClick: onAddVisitor,
            show: canAdd,
          },
          {
            key: "review",
            label: t("reviewCta"),
            onClick: review,
            show: canApprove,
          },
        ]
  ).filter((a) => a.show);
  const empty = actions.length === 0;

  return (
    <>
      <DecorChevrons />
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
      <div className="relative flex flex-wrap items-center gap-3">
        {empty ? (
          <Button
            intent="accent"
            onClick={() => router.push("/admin/v2/requests")}
          >
            {t("activityCta")}
          </Button>
        ) : (
          // First action primary, second accent (VMC Quick actions pair).
          actions.map((a, i) => (
            <Button
              key={a.key}
              intent={i === 0 ? "primary" : "accent"}
              onClick={a.onClick}
            >
              {a.label}
            </Button>
          ))
        )}
      </div>
    </>
  );
}
