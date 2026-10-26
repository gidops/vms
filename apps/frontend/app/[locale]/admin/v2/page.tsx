"use client";

import { TopNavShell } from "@vms/ui";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { useEvacuationAlertCount } from "@/app/[locale]/_components/EvacuationIndicator";
import { QuickActionSheet } from "@/app/[locale]/dashboard/_components/QuickActionSheet";
import { RouteGuard } from "@/shared/auth/RouteGuard";
import { AdminActionPanel } from "./_components/AdminActionPanel";
import { AdminActivityFeed } from "./_components/AdminActivityFeed";
import { AdminFilters, useAdminFilters } from "./_components/AdminFilters";
import { AdminOverview } from "./_components/AdminOverview";
import { AdminUpcomingFeed } from "./_components/AdminUpcomingFeed";
import { AdminVisitsTable } from "./_components/AdminVisitsTable";
import { useAdminBand } from "./_components/useAdminBand";
import { useVisitOverlays } from "./_components/VisitOverlays";

/**
 * Admin console v2 — Overview tab, rebuilt from the VMC and staff dashboards:
 * nav → filter bar → overview band → table area. Traffic and status charts
 * live on the Analytics tab (as /admin moved them to /admin/analytics).
 *
 * `?layout=staff` previews the staff-flavoured arrangement (search-only bar,
 * staff band, staff table beside the activity/upcoming feed column); the
 * default is the VMC arrangement (full filters, VMC band, full-width records
 * table with the Today / Upcoming / Yesterday pills).
 */
function Overview() {
  const layout = useSearchParams().get("layout") === "staff" ? "staff" : "vmc";
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
          variant={layout === "staff" ? "search" : "full"}
          value={filters.filters}
          onChange={filters.onChange}
          onSearch={filters.onSearch}
        />
      }
    >
      <div className="flex flex-col gap-6">
        <AdminOverview
          variant={layout}
          eyebrow={band.eyebrow}
          welcome={band.welcome}
          stats={band.stats}
          pendingCount={band.pendingCount}
          panelTone={evacuationCount > 0 ? "alert" : "default"}
          panel={
            <AdminActionPanel onAddVisitor={() => setAddingVisitor(true)} />
          }
        />

        {layout === "staff" ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
            <AdminVisitsTable
              columns="staff"
              range="staff"
              query={filters.query}
              onOpen={openRow}
            />
            <div className="flex flex-col gap-6">
              <AdminActivityFeed variant="updates" onSelect={open} />
              <AdminUpcomingFeed
                onView={(id) => open({ kind: "request", id })}
              />
            </div>
          </div>
        ) : (
          <AdminVisitsTable
            columns="vmc"
            range="myVisits"
            query={filters.query}
            onOpen={openRow}
          />
        )}
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
