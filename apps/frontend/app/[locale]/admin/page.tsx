"use client";

import { SearchInput } from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";
import { VisitDetailSheet } from "@/app/[locale]/_components/VisitDetailSheet";
import { AdminShell } from "@/app/[locale]/admin/_components/AdminShell";
import { OverviewStats } from "@/app/[locale]/admin/_components/OverviewStats";
import { QuickActionsCard } from "@/app/[locale]/admin/_components/QuickActionsCard";
import { RecentActivityCard } from "@/app/[locale]/admin/_components/RecentActivityCard";
import { StatusBreakdownCard } from "@/app/[locale]/admin/_components/StatusBreakdownCard";
import { TodaysVisitorsCard } from "@/app/[locale]/admin/_components/TodaysVisitorsCard";
import { TrafficCard } from "@/app/[locale]/admin/_components/TrafficCard";
import { UpcomingCard } from "@/app/[locale]/admin/_components/UpcomingCard";
import { QuickActionSheet } from "@/app/[locale]/dashboard/_components/QuickActionSheet";
import { useAdminOverviewStats } from "@/data/admin/queries";
import { RouteGuard } from "@/shared/auth/RouteGuard";

/**
 * Admin console overview (Figma: aatc-vms-admin-overview). Shared by every
 * admin role; each card/action is gated by permission, so the same page serves
 * System Admin, VMC Admin, Security Manager and Read Admin.
 */
function Overview() {
  const t = useTranslations("admin.overview");
  const stats = useAdminOverviewStats();
  // The top-nav search and the table's own field drive the same filter.
  const [search, setSearch] = React.useState("");
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [addingVisitor, setAddingVisitor] = React.useState(false);

  return (
    <AdminShell
      active="overview"
      search={
        <SearchInput
          variant="onEmphasis"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
        />
      }
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-fg">{t("title")}</h1>
            <p className="text-sm text-fg-muted">{t("subtitle")}</p>
          </header>

          <OverviewStats stats={stats.data} loading={stats.isLoading} />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
            <TrafficCard />
            <StatusBreakdownCard stats={stats.data} loading={stats.isLoading} />
          </div>

          <TodaysVisitorsCard
            search={search}
            onSearchChange={setSearch}
            onView={setDetailId}
          />
        </div>

        <aside
          aria-label={t("sidePanel")}
          className="flex w-full shrink-0 flex-col gap-4 xl:w-80"
        >
          <QuickActionsCard onAddVisitor={() => setAddingVisitor(true)} />
          <RecentActivityCard />
          <UpcomingCard onView={setDetailId} />
        </aside>
      </div>

      <QuickActionSheet
        mode={addingVisitor ? "invite" : null}
        onClose={() => setAddingVisitor(false)}
      />
      {detailId ? (
        <VisitDetailSheet
          kind="request"
          id={detailId}
          onClose={() => setDetailId(null)}
        />
      ) : null}
    </AdminShell>
  );
}

export default function AdminPage() {
  return (
    <RouteGuard home="/admin">
      <Overview />
    </RouteGuard>
  );
}
