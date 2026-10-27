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

/** Recent Activity tab; `?layout=staff` shows the pending-approvals table instead. */
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
