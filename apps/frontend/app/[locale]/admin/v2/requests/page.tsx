"use client";

import { TopNavShell } from "@vms/ui";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { RequestsAlertsScreen } from "@/app/[locale]/_components/RequestsAlertsScreen";
import { RouteGuard } from "@/shared/auth/RouteGuard";
import { AdminFilters, useAdminFilters } from "../_components/AdminFilters";
import { PendingApprovalsTable } from "../_components/PendingApprovalsTable";
import { useVisitOverlays } from "../_components/VisitOverlays";

/** Variant B: the approval queue as a staff "My Visits"-style table. */
function PendingApprovalsScreen() {
  const filters = useAdminFilters();
  const { openRow, denyRow, overlays } = useVisitOverlays();
  return (
    <TopNavShell
      nav={<AppTopNav app="admin" active="requests" />}
      filterBar={
        <AdminFilters
          variant="search"
          value={filters.filters}
          onChange={filters.onChange}
          onSearch={filters.onSearch}
        />
      }
    >
      <PendingApprovalsTable
        query={filters.query}
        onOpen={openRow}
        onDeny={denyRow}
      />
      {overlays}
    </TopNavShell>
  );
}

/**
 * Admin console v2 — Recent Activity tab (formerly Requests & Alerts). Merges the old approval queue
 * (`/admin/requests`) and activity inbox (`/admin/activity`): by default the
 * VMC Requests & Alerts screen (approve/deny happen in the detail sheet);
 * `?layout=staff` previews the staff-style pending-approvals table.
 */
function Requests() {
  const tNav = useTranslations("nav");
  const layout = useSearchParams().get("layout");
  return layout === "staff" ? (
    <PendingApprovalsScreen />
  ) : (
    <RequestsAlertsScreen
      app="admin"
      scope="all"
      title={tNav("recentActivity")}
    />
  );
}

export default function AdminV2RequestsPage() {
  return (
    <RouteGuard home="/admin">
      <React.Suspense>
        <Requests />
      </React.Suspense>
    </RouteGuard>
  );
}
