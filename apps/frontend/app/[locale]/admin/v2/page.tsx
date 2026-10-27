"use client";

import { TopNavShell } from "@vms/ui";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { useEvacuationAlertCount } from "@/app/[locale]/_components/EvacuationIndicator";
import { QuickActionSheet } from "@/app/[locale]/dashboard/_components/QuickActionSheet";
import { useAuth } from "@/shared/auth/AuthContext";
import { RouteGuard } from "@/shared/auth/RouteGuard";
import { AdminActionPanel } from "./_components/AdminActionPanel";
import { AdminActivityFeed } from "./_components/AdminActivityFeed";
import { AdminFilters, useAdminFilters } from "./_components/AdminFilters";
import { AdminOverview } from "./_components/AdminOverview";
import { AdminVisitsTable } from "./_components/AdminVisitsTable";
import { adminConsoleRole } from "@/shared/auth/adminConsoleRole";
import { PendingApprovalsTable } from "./_components/PendingApprovalsTable";
import { useAdminBand } from "./_components/useAdminBand";
import { useVisitOverlays } from "./_components/VisitOverlays";

/** The Security Manager gets the pending-approvals queue; the System Admin gets Visitor Records. */
function Overview() {
  const { hasPermission } = useAuth();
  const role = adminConsoleRole(hasPermission);
  const band = useAdminBand();
  const filters = useAdminFilters();
  const { openRow, open, overlays } = useVisitOverlays();
  const [addingVisitor, setAddingVisitor] = React.useState(false);
  // Tints the quick-actions panel while anyone is on the Evacuation Roll.
  const evacuationCount = useEvacuationAlertCount();

  return (
    <TopNavShell
      nav={<AppTopNav app="admin" active="overview" />}
      filterBar={
        <AdminFilters
          variant="full"
          value={filters.filters}
          onChange={filters.onChange}
          onSearch={filters.onSearch}
        />
      }
    >
      <div className="flex flex-col gap-6">
        <AdminOverview
          eyebrow={band.eyebrow}
          eyebrowIcon={band.eyebrowIcon}
          welcome={band.welcome}
          stats={band.stats}
          panelTone={evacuationCount > 0 ? "alert" : "default"}
          panel={
            <AdminActionPanel onAddVisitor={() => setAddingVisitor(true)} />
          }
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
          {role === "securityManager" ? (
            <PendingApprovalsTable
              variant="vmc"
              query={filters.query}
              onOpen={openRow}
            />
          ) : (
            <AdminVisitsTable
              columns="vmc"
              range="myVisits"
              query={filters.query}
              onOpen={openRow}
            />
          )}
          <AdminActivityFeed variant="updates" onSelect={open} />
        </div>
      </div>

      <QuickActionSheet
        mode={addingVisitor ? "invite" : null}
        onClose={() => setAddingVisitor(false)}
      />
      {overlays}
    </TopNavShell>
  );
}

export default function AdminV2Page() {
  return (
    <RouteGuard home="/admin">
      <React.Suspense>
        <Overview />
      </React.Suspense>
    </RouteGuard>
  );
}
