"use client";

import { SearchInput } from "@vms/ui";
import { useTranslations } from "next-intl";
import * as React from "react";
import { VisitDetailSheet } from "@/app/[locale]/_components/VisitDetailSheet";
import { AdminOverviewBar } from "@/app/[locale]/admin/_components/AdminOverviewBar";
import { AdminShell } from "@/app/[locale]/admin/_components/AdminShell";
import { PendingApprovalsCard } from "@/app/[locale]/admin/_components/PendingApprovalsCard";
import { RecentActivityCard } from "@/app/[locale]/admin/_components/RecentActivityCard";
import { TodaysVisitorsCard } from "@/app/[locale]/admin/_components/TodaysVisitorsCard";
import { QuickActionSheet } from "@/app/[locale]/dashboard/_components/QuickActionSheet";
import { RouteGuard } from "@/shared/auth/RouteGuard";

/** Every block is permission-gated so one page serves all admin roles; empty blocks are omitted. */
function Overview() {
  const t = useTranslations("admin.overview");
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
      <div className="flex flex-col gap-6">
        <AdminOverviewBar onAddVisitor={() => setAddingVisitor(true)} />

        <PendingApprovalsCard />

        {/* Flex, not grid: when one block is empty the other takes the full width. */}
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          <TodaysVisitorsCard
            search={search}
            onSearchChange={setSearch}
            onView={setDetailId}
            className="min-w-0 xl:flex-[5]"
          />
          <RecentActivityCard className="min-w-0 xl:flex-[2.4]" />
        </div>
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
