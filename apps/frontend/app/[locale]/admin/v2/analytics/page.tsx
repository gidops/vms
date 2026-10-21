"use client";

import { PERMISSIONS } from "@vms/contracts";
import { Alert, AlertDescription, Button, TopNavShell } from "@vms/ui";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { ExportVisitorsDialog } from "@/app/[locale]/_components/ExportVisitorsDialog";
import {
  StatCell,
  type OverviewStat,
} from "@/app/[locale]/_components/OverviewBar";
import { useAdminOverviewStats } from "@/data/admin/queries";
import { useAuth } from "@/shared/auth/AuthContext";
import { PermissionGate } from "@/shared/auth/PermissionGate";
import { RouteGuard } from "@/shared/auth/RouteGuard";
import { AdminChartsPanel } from "../_components/AdminChartsPanel";
import { AdminUpcomingFeed } from "../_components/AdminUpcomingFeed";
import { useVisitOverlays } from "../_components/VisitOverlays";

/**
 * Admin console v2 — Analytics tab (the v2 take on /admin/analytics): a KPI
 * row in the overview-band cell style, traffic + status breakdown, upcoming
 * arrivals, and the visitor export for `report:export` holders.
 */
function Analytics() {
  const t = useTranslations("admin.analytics");
  const tStats = useTranslations("admin.overview.stats");
  const tV2 = useTranslations("adminV2.overview");
  const { hasPermission } = useAuth();
  const stats = useAdminOverviewStats();
  const { open, overlays } = useVisitOverlays();
  const [exportOpen, setExportOpen] = React.useState(false);
  const canExport = hasPermission(PERMISSIONS.REPORT_EXPORT);
  const s = stats.data;
  const v = (n: number | undefined) => n ?? "—";

  const delta = s ? s.visitorsToday - s.visitorsYesterday : 0;
  const kpis: OverviewStat[] = [
    {
      label: tStats("visitorsToday"),
      value: v(s?.visitorsToday),
      hint: !s
        ? undefined
        : delta === 0
          ? tStats("sameAsYesterday")
          : tV2(delta > 0 ? "trendUp" : "trendDown", {
              count: Math.abs(delta),
            }),
    },
    {
      label: tStats("checkedOut"),
      value: v(s?.checkedOutToday),
      hint: tStats("checkedOutHint"),
    },
    { label: t("denied"), value: v(s?.deniedToday), hint: t("deniedHint") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-primary">{t("title")}</h1>
        {canExport ? (
          <Button onClick={() => setExportOpen(true)}>
            <Download className="size-4" aria-hidden="true" />
            {t("export")}
          </Button>
        ) : null}
      </div>

      {stats.isError ? (
        <Alert intent="danger">
          <AlertDescription>{t("loadError")}</AlertDescription>
        </Alert>
      ) : null}

      <div
        className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-primary-subtle shadow-xs sm:grid-cols-3 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse"
        aria-busy={stats.isLoading || undefined}
      >
        {kpis.map((kpi) => (
          <StatCell key={kpi.label} stat={kpi} />
        ))}
      </div>

      <AdminChartsPanel stats={s} />

      <AdminUpcomingFeed onView={(id) => open({ kind: "request", id })} />

      {canExport ? (
        <ExportVisitorsDialog open={exportOpen} onOpenChange={setExportOpen} />
      ) : null}
      {overlays}
    </div>
  );
}

export default function AdminV2AnalyticsPage() {
  return (
    <RouteGuard home="/admin">
      <TopNavShell nav={<AppTopNav app="admin" active="analytics" />}>
        <PermissionGate permission={PERMISSIONS.REPORT_READ}>
          <Analytics />
        </PermissionGate>
      </TopNavShell>
    </RouteGuard>
  );
}
