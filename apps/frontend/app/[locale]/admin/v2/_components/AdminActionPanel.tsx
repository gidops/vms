"use client";

import { PERMISSIONS } from "@vms/contracts";
import { Button } from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";
import { ExportVisitorsDialog } from "@/app/[locale]/_components/ExportVisitorsDialog";
import { DecorChevrons } from "@/app/[locale]/_components/OverviewBar";
import { ADMIN_PERMISSIONS } from "@/app/[locale]/admin/_components/adminAccess";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";

/**
 * The brand-green quick-actions content of the overview band (VMC
 * `QuickActions` / staff `BookPanel`), replacing the old admin `QuickActionsCard`
 * tiles. Export opens the shared visitor export dialog (date range + CSV/Excel). Actions are permission-gated; a role that can use none of them gets
 * a single call to action into the Requests tab instead (review for approvers,
 * view activity for read-only roles), so the panel is never empty.
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
  const [exportOpen, setExportOpen] = React.useState(false);

  const canAdd = hasPermission(PERMISSIONS.INVITATION_CREATE);
  const canExport = hasPermission(ADMIN_PERMISSIONS.REPORT_EXPORT);
  const canApprove = hasPermission(PERMISSIONS.VISIT_APPROVE);
  const hasQuickActions = canAdd || canExport;

  const title = hasQuickActions
    ? tQa("title")
    : canApprove
      ? t("reviewTitle")
      : t("activityTitle");

  return (
    <>
      <DecorChevrons />
      <div className="relative flex flex-col gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/afreximbank.svg"
          alt=""
          className="size-8"
          aria-hidden="true"
        />
        <h3 className="whitespace-pre-line text-lg font-semibold">{title}</h3>
      </div>
      <div className="relative flex flex-wrap items-center gap-3">
        {canAdd ? (
          <Button intent="primary" onClick={onAddVisitor}>
            {tQa("addVisitor")}
          </Button>
        ) : null}
        {canExport ? (
          <Button intent="accent" onClick={() => setExportOpen(true)}>
            {tQa("exportData")}
          </Button>
        ) : null}
        {!hasQuickActions || canApprove ? (
          <Button
            intent={hasQuickActions ? "primary" : "accent"}
            onClick={() => router.push("/admin/v2/requests")}
          >
            {canApprove ? t("reviewCta") : t("activityCta")}
          </Button>
        ) : null}
      </div>
      {canExport ? (
        <ExportVisitorsDialog open={exportOpen} onOpenChange={setExportOpen} />
      ) : null}
    </>
  );
}
