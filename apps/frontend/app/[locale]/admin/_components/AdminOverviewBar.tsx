"use client";

import { PERMISSIONS } from "@vms/contracts";
import { Button } from "@vms/ui";
import { Download, ShieldCheck, UserPlus } from "lucide-react";
import { useNow, useTranslations } from "next-intl";
import * as React from "react";
import { ExportVisitorsDialog } from "@/app/[locale]/_components/ExportVisitorsDialog";
import {
  OverviewBar,
  type OverviewStat,
} from "@/app/[locale]/_components/OverviewBar";
import { useAdminOverviewStats } from "@/data/admin/queries";
import { usePendingVisits } from "@/data/requests/queries";
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
  const tRoles = useTranslations("roles");
  const { user, activeRole } = useAuth();
  const now = useNow({ updateInterval: 60_000 });
  const eyebrow =
    activeRole && tRoles.has(activeRole as "ADMIN")
      ? tRoles(activeRole as "ADMIN")
      : t("eyebrow");
  const first = user?.fullName?.split(" ")[0];
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-base font-semibold uppercase tracking-tight text-success">
        <ShieldCheck className="size-4" aria-hidden="true" />
        {eyebrow}
      </span>
      <h1 className="text-4xl font-semibold text-fg">
        {first
          ? t("greetingName", { part: dayPart(now), name: first })
          : t("greeting", { part: dayPart(now) })}
      </h1>
    </div>
  );
}

function ActionsPanel({ onAddVisitor }: { onAddVisitor: () => void }) {
  const t = useTranslations("admin.overview.bar");
  const { hasPermission } = useAuth();
  const [exportOpen, setExportOpen] = React.useState(false);
  const canReview = hasPermission(PERMISSIONS.VISIT_APPROVE);
  const canAdd = hasPermission(PERMISSIONS.INVITATION_CREATE);
  const canExport = hasPermission(ADMIN_PERMISSIONS.REPORT_EXPORT);
  const none = !canReview && !canAdd && !canExport;
  return (
    <>
      <h3 className="relative text-lg font-semibold">{t("actionsTitle")}</h3>
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
  const pending = usePendingVisits();
  const now = useNow({ updateInterval: 60_000 });
  const value = (n: number | undefined) => n ?? "—";
  const overdue = pending.data ? countOverdue(pending.data.items, now) : 0;

  const cells: OverviewStat[] = [
    {
      label: t("awaiting"),
      value: value(stats.data?.pending),
      tone: "warning",
      hint:
        overdue > 0
          ? t("awaitingOverdue", { count: overdue })
          : t("awaitingHint"),
    },
    {
      label: t("onsite"),
      value: value(stats.data?.onsite),
      hint: t("onsiteHint"),
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
        panel={<ActionsPanel onAddVisitor={onAddVisitor} />}
      />
      {stats.isError ? (
        <p role="alert" className="text-sm text-danger">
          {t("loadError")}
        </p>
      ) : null}
    </div>
  );
}
