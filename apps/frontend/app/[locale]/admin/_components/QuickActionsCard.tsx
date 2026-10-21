"use client";

import { PERMISSIONS } from "@vms/contracts";
import { ActionTile } from "@vms/ui";
import { Download, Printer, QrCode, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { ExportVisitorsDialog } from "@/app/[locale]/_components/ExportVisitorsDialog";
import { useAuth } from "@/shared/auth/AuthContext";
import { ADMIN_PERMISSIONS } from "./adminAccess";
import { SectionCard } from "./SectionCard";

/**
 * Permission-gated shortcuts. Print Badge and Scan QR have no flow yet, so they
 * render disabled with a visible "coming soon" note for roles that will be
 * able to use them.
 * Hidden entirely when the active role can't use any action (e.g. Read Admin
 * without export).
 */
export function QuickActionsCard({
  onAddVisitor,
}: {
  onAddVisitor: () => void;
}) {
  const t = useTranslations("admin.overview.quickActions");
  const { hasPermission } = useAuth();
  const [exportOpen, setExportOpen] = React.useState(false);

  const canAdd = hasPermission(PERMISSIONS.INVITATION_CREATE);
  const canExport = hasPermission(ADMIN_PERMISSIONS.REPORT_EXPORT);
  const canCheckIn = hasPermission(PERMISSIONS.VISIT_CHECK_IN);
  if (!canAdd && !canExport && !canCheckIn) return null;

  return (
    <SectionCard titleId="admin-quick-actions" title={t("title")}>
      <div className="grid grid-cols-2 gap-3">
        {canAdd ? (
          <ActionTile intent="primary" icon={UserPlus} onClick={onAddVisitor}>
            {t("addVisitor")}
          </ActionTile>
        ) : null}
        {canExport ? (
          <ActionTile icon={Download} onClick={() => setExportOpen(true)}>
            {t("exportData")}
          </ActionTile>
        ) : null}
        {canCheckIn ? (
          <>
            <ActionTile icon={Printer} disabled>
              <span className="flex flex-col items-center">
                {t("printBadge")}
                <span className="text-xs font-normal text-fg-muted">
                  {t("comingSoon")}
                </span>
              </span>
            </ActionTile>
            <ActionTile icon={QrCode} disabled>
              <span className="flex flex-col items-center">
                {t("scanQr")}
                <span className="text-xs font-normal text-fg-muted">
                  {t("comingSoon")}
                </span>
              </span>
            </ActionTile>
          </>
        ) : null}
      </div>
      {canExport ? (
        <ExportVisitorsDialog open={exportOpen} onOpenChange={setExportOpen} />
      ) : null}
    </SectionCard>
  );
}
