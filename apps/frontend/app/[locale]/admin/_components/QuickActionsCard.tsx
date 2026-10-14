"use client";

import { PERMISSIONS } from "@vms/contracts";
import { ActionTile } from "@vms/ui";
import { Download, Printer, QrCode, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import Papa from "papaparse";
import * as React from "react";
import { dayWindow } from "@/data/admin/queries";
import { visitsApi } from "@/data/visits/visits.api";
import { useAuth } from "@/shared/auth/AuthContext";
import { ADMIN_PERMISSIONS } from "./adminAccess";
import { SectionCard } from "./SectionCard";

/** Today's visits as a CSV download (first 100 rows — the list API's page cap). */
async function exportTodaysVisits(filename: string) {
  const page = await visitsApi.list({ ...dayWindow(0), pageSize: 100 });
  const csv = Papa.unparse(
    page.items.map((v) => ({
      visitor: v.isGroupVisit && v.groupName ? v.groupName : v.visitor.fullName,
      email: v.isGroupVisit ? (v.groupContact ?? "") : v.visitor.email,
      organization: v.visitor.organization ?? "",
      status: v.status,
      host: v.host?.user.fullName ?? v.floor ?? "",
      guests: v.groupSize,
      purpose: v.purpose,
      scheduledAt: v.scheduledAt ?? "",
      checkInAt: v.checkInAt ?? "",
      checkOutAt: v.checkOutAt ?? "",
    })),
  );
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
  const [exporting, setExporting] = React.useState(false);
  const [exportFailed, setExportFailed] = React.useState(false);

  const canAdd = hasPermission(PERMISSIONS.INVITATION_CREATE);
  const canExport = hasPermission(ADMIN_PERMISSIONS.REPORT_EXPORT);
  const canCheckIn = hasPermission(PERMISSIONS.VISIT_CHECK_IN);
  if (!canAdd && !canExport && !canCheckIn) return null;

  const onExport = async () => {
    setExporting(true);
    setExportFailed(false);
    try {
      const date = new Date().toISOString().slice(0, 10);
      await exportTodaysVisits(`visitors-${date}.csv`);
    } catch {
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <SectionCard titleId="admin-quick-actions" title={t("title")}>
      <div className="grid grid-cols-2 gap-3">
        {canAdd ? (
          <ActionTile intent="primary" icon={UserPlus} onClick={onAddVisitor}>
            {t("addVisitor")}
          </ActionTile>
        ) : null}
        {canExport ? (
          <ActionTile
            icon={Download}
            onClick={() => void onExport()}
            disabled={exporting}
            aria-busy={exporting || undefined}
          >
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
      {exportFailed ? (
        <p role="alert" className="pt-3 text-sm text-danger">
          {t("exportFailed")}
        </p>
      ) : null}
    </SectionCard>
  );
}
