"use client";

import { TopNavShell } from "@vms/ui";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { RouteGuard } from "@/shared/auth/RouteGuard";
import { AdminFilters, useAdminFilters } from "../_components/AdminFilters";
import { PendingApprovalsTable } from "../_components/PendingApprovalsTable";
import { useVisitOverlays } from "../_components/VisitOverlays";

function Approvals() {
  const filters = useAdminFilters();
  const { openRow, overlays } = useVisitOverlays();
  return (
    <TopNavShell
      nav={<AppTopNav app="admin" active="approvals" />}
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
        actions="review"
      />
      {overlays}
    </TopNavShell>
  );
}

export default function AdminApprovalsPage() {
  return (
    <RouteGuard home="/admin">
      <React.Suspense>
        <Approvals />
      </React.Suspense>
    </RouteGuard>
  );
}
