"use client";

import { Button, StatCard, type StatCardProps } from "@vms/ui";
import { CircleX, Download, LogOut, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { ExportVisitorsDialog } from "@/app/[locale]/_components/ExportVisitorsDialog";
import { VisitDetailSheet } from "@/app/[locale]/_components/VisitDetailSheet";
import { AdminShell } from "@/app/[locale]/admin/_components/AdminShell";
import { StatusBreakdownCard } from "@/app/[locale]/admin/_components/StatusBreakdownCard";
import { TrafficCard } from "@/app/[locale]/admin/_components/TrafficCard";
import { UpcomingCard } from "@/app/[locale]/admin/_components/UpcomingCard";
import { ADMIN_PERMISSIONS } from "@/app/[locale]/admin/_components/adminAccess";
import {
  useAdminOverviewStats,
  type AdminOverviewStats,
} from "@/data/admin/queries";
import { useAuth } from "@/shared/auth/AuthContext";
import { PermissionGate } from "@/shared/auth/PermissionGate";
import { RouteGuard } from "@/shared/auth/RouteGuard";

function Kpis({ stats }: { stats: AdminOverviewStats }) {
  const t = useTranslations("admin.overview.stats");
  const tA = useTranslations("admin.analytics");
  const delta = stats.visitorsToday - stats.visitorsYesterday;
  const cards: StatCardProps[] = [
    {
      label: t("visitorsToday"),
      value: stats.visitorsToday,
      icon: Users,
      tone: "success",
      trend:
        delta === 0
          ? undefined
          : {
              value: Math.abs(delta),
              direction: delta > 0 ? "up" : "down",
              label: t("fromYesterday"),
            },
      hint: delta === 0 ? t("sameAsYesterday") : undefined,
    },
    {
      label: t("checkedOut"),
      value: stats.checkedOutToday,
      icon: LogOut,
      tone: "neutral",
      hint: t("checkedOutHint"),
    },
    {
      label: tA("denied"),
      value: stats.deniedToday,
      icon: CircleX,
      tone: "warning",
      hint: tA("deniedHint"),
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <StatCard key={card.label} layout="stacked" {...card} />
      ))}
    </div>
  );
}

/**
 * Analytics & Reports: the trend and outcome cards that left the overview
 * (traffic, status breakdown, upcoming arrivals) plus a small KPI row and the
 * visitor export. Gated by `report:read`.
 */
function Analytics() {
  const t = useTranslations("admin.analytics");
  const { hasPermission } = useAuth();
  const stats = useAdminOverviewStats();
  const [exportOpen, setExportOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const canExport = hasPermission(ADMIN_PERMISSIONS.REPORT_EXPORT);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-fg">{t("title")}</h1>
          <p className="text-sm text-fg-muted">{t("subtitle")}</p>
        </div>
        {canExport ? (
          <Button intent="primary" onClick={() => setExportOpen(true)}>
            <Download className="size-4" aria-hidden="true" />
            {t("export")}
          </Button>
        ) : null}
      </header>

      {stats.data ? (
        <Kpis stats={stats.data} />
      ) : (
        <p
          role={stats.isError ? "alert" : "status"}
          className={stats.isError ? "text-danger" : "text-fg-muted"}
        >
          {stats.isError ? t("loadError") : t("loading")}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
        <TrafficCard />
        {stats.data ? (
          <StatusBreakdownCard stats={stats.data} loading={false} />
        ) : null}
      </div>

      <UpcomingCard onView={setDetailId} />

      {canExport ? (
        <ExportVisitorsDialog open={exportOpen} onOpenChange={setExportOpen} />
      ) : null}
      {detailId ? (
        <VisitDetailSheet
          kind="request"
          id={detailId}
          onClose={() => setDetailId(null)}
        />
      ) : null}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <RouteGuard home="/admin">
      <AdminShell active="analytics">
        <PermissionGate permission={ADMIN_PERMISSIONS.REPORT_READ}>
          <Analytics />
        </PermissionGate>
      </AdminShell>
    </RouteGuard>
  );
}
