"use client";

import { PERMISSIONS, ROLES } from "@vms/contracts";
import { Button } from "@vms/ui";
import { Download, ServerCog, ShieldCheck, UserPlus } from "lucide-react";
import { useNow, useTranslations } from "next-intl";
import * as React from "react";
import {
  EvacuationRollLink,
  useEvacuationAlertCount,
} from "@/app/[locale]/_components/EvacuationIndicator";
import { ExportVisitorsDialog } from "@/app/[locale]/_components/ExportVisitorsDialog";
import {
  OverviewBar,
  type OverviewStat,
} from "@/app/[locale]/_components/OverviewBar";
import { useAdminOverviewStats, useApprovalQueue } from "@/data/admin/queries";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";
import { ADMIN_PERMISSIONS } from "./adminAccess";
import { countOverdue } from "./pendingApprovals";

/** "morning" | "afternoon" | "evening" for the greeting, by local hour. */
export function dayPart(now: Date): "morning" | "afternoon" | "evening" {
  const h = now.getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function Heading() {
  const t = useTranslations("admin.overview.bar");
  const { user, activeRole } = useAuth();
  const now = useNow({ updateInterval: 60_000 });
  // Each admin role has its own console name ("Security console" for the
  // Security Manager); anything else falls back to "Admin console".
  const consoleKey = `console.${activeRole ?? ""}` as "console.ADMIN";
  const eyebrow = t.has(consoleKey) ? t(consoleKey) : t("eyebrow");
  // Same icons as the v2 console: system gear for the System Admin.
  const Icon = activeRole === ROLES.SUPER_ADMIN ? ServerCog : ShieldCheck;
  const first = user?.fullName?.split(" ")[0];
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-base font-semibold uppercase tracking-tight text-success">
        <Icon className="size-4" aria-hidden="true" />
        {eyebrow}
      </span>
      <h1 className="text-[2rem] font-medium leading-tight text-[#344054]">
        {first
          ? t("greetingName", { part: dayPart(now), name: first })
          : t("greeting", { part: dayPart(now) })}
      </h1>
    </div>
  );
}

function ActionsPanel({
  onAddVisitor,
  evacuationCount,
}: {
  onAddVisitor: () => void;
  evacuationCount: number;
}) {
  const t = useTranslations("admin.overview.bar");
  const { hasPermission } = useAuth();
  const [exportOpen, setExportOpen] = React.useState(false);
  const canReview = hasPermission(PERMISSIONS.VISIT_APPROVE);
  const canAdd = hasPermission(PERMISSIONS.INVITATION_CREATE);
  const canExport = hasPermission(ADMIN_PERMISSIONS.REPORT_EXPORT);
  const none = !canReview && !canAdd && !canExport;
  return (
    <>
      <div className="relative flex flex-col gap-2">
        <h3 className="text-lg font-semibold">{t("actionsTitle")}</h3>
        <EvacuationRollLink count={evacuationCount} />
      </div>
      <div className="relative flex flex-wrap items-center gap-3">
        {canReview ? (
          <Button asChild intent="accent">
            <Link href="/admin/requests">{t("reviewApprovals")}</Link>
          </Button>
        ) : null}
        {canAdd ? (
          <Button intent="primary" onClick={onAddVisitor}>
            <UserPlus className="size-4" aria-hidden="true" />
            {t("addVisitor")}
          </Button>
        ) : null}
        {canExport ? (
          <Button
            intent="accent"
            tone="outline"
            onClick={() => setExportOpen(true)}
          >
            <Download className="size-4" aria-hidden="true" />
            {t("export")}
          </Button>
        ) : null}
        {none ? (
          <p className="text-sm text-emphasis-fg/80">{t("readOnly")}</p>
        ) : null}
      </div>
      {canExport ? (
        <ExportVisitorsDialog open={exportOpen} onOpenChange={setExportOpen} />
      ) : null}
    </>
  );
}

/**
 * Admin console overview bar on the shared {@link OverviewBar}: Awaiting
 * approval (the warning-toned hero), Onsite now, Expected today, and a
 * permission-gated action panel (Review approvals, Add visitor, Export).
 */
export function AdminOverviewBar({
  onAddVisitor,
}: {
  onAddVisitor: () => void;
}) {
  const t = useTranslations("admin.overview.bar");
  const stats = useAdminOverviewStats();
  const queue = useApprovalQueue();
  const evacuationCount = useEvacuationAlertCount();
  const now = useNow({ updateInterval: 60_000 });
  const value = (n: number | undefined) => n ?? "—";
  const overdue = queue.data ? countOverdue(queue.data.items, now) : 0;
  // Same count as the pending approvals card: requests to decide plus those
  // sent back to the host for more information.
  const moreInfo = stats.data?.reviewRequested ?? 0;
  const awaiting = stats.data ? stats.data.pending + moreInfo : undefined;
  const awaitingHint =
    overdue > 0
      ? t("awaitingOverdue", { count: overdue })
      : awaiting === 0
        ? t("awaitingNone")
        : moreInfo > 0
          ? t("awaitingMoreInfo", { count: moreInfo })
          : t("awaitingHint");
  const floors = stats.data?.onsiteFloors ?? 0;

  const cells: OverviewStat[] = [
    {
      label: t("awaiting"),
      value: value(awaiting),
      tone: "warning",
      hint: awaitingHint,
    },
    {
      label: t("onsite"),
      value: value(stats.data?.onsite),
      hint: floors > 0 ? t("onsiteFloors", { count: floors }) : t("onsiteHint"),
    },
    {
      label: t("expected"),
      value: value(stats.data?.expected),
      hint: t("expectedHint"),
    },
  ];

  return (
    <div
      className="flex flex-col gap-2"
      aria-busy={stats.isLoading || undefined}
    >
      <OverviewBar
        heading={<Heading />}
        stats={cells}
        panelTone={evacuationCount > 0 ? "alert" : "default"}
        panel={
          <ActionsPanel
            onAddVisitor={onAddVisitor}
            evacuationCount={evacuationCount}
          />
        }
      />
      {stats.isError ? (
        <p role="alert" className="text-sm text-danger">
          {t("loadError")}
        </p>
      ) : null}
    </div>
  );
}
