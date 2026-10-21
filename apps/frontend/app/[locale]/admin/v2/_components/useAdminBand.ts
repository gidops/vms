"use client";

import { PERMISSIONS } from "@vms/contracts";
import { useNow, useTranslations } from "next-intl";
import type { OverviewStat } from "@/app/[locale]/_components/OverviewBar";
import { countOverdue } from "@/app/[locale]/admin/_components/pendingApprovals";
import { useAdminOverviewStats, useApprovalQueue } from "@/data/admin/queries";
import { useAuth } from "@/shared/auth/AuthContext";
import { roleLabel } from "@/shared/auth/roleLabels";

/**
 * Data for the admin overview band: the eyebrow/welcome copy and the five
 * headline stats (formerly the `StatCard` grid). "Visitors Today" carries the
 * vs-yesterday trend as its sub-line.
 *
 * From the role-aware /admin overview: the eyebrow names the role's console
 * ("Security console" …), "Awaiting approval" counts requests to decide plus
 * those sent back for more info, and for approvers it is the warning-toned
 * hero with an over-1-hour hint; "Onsite" says how many floors.
 */
export function useAdminBand() {
  const t = useTranslations("admin.overview.stats");
  const tBar = useTranslations("admin.overview.bar");
  const tV2 = useTranslations("adminV2.overview");
  const tRoles = useTranslations("roles");
  const { user, activeRole, hasPermission } = useAuth();
  const canApprove = hasPermission(PERMISSIONS.VISIT_APPROVE);
  const q = useAdminOverviewStats();
  const queue = useApprovalQueue({ enabled: canApprove });
  const now = useNow({ updateInterval: 60_000 });
  const s = q.data;
  const v = (n: number | undefined) => n ?? "—";

  const delta = s ? s.visitorsToday - s.visitorsYesterday : 0;
  const trend = !s
    ? undefined
    : delta === 0
      ? t("sameAsYesterday")
      : tV2(delta > 0 ? "trendUp" : "trendDown", { count: Math.abs(delta) });

  const moreInfo = s?.reviewRequested ?? 0;
  const awaiting = s ? s.pending + moreInfo : undefined;
  const overdue = queue.data ? countOverdue(queue.data.items, now) : 0;
  const awaitingHint = !s
    ? undefined
    : overdue > 0
      ? tBar("awaitingOverdue", { count: overdue })
      : awaiting === 0
        ? tBar("awaitingNone")
        : moreInfo > 0
          ? tBar("awaitingMoreInfo", { count: moreInfo })
          : tBar("awaitingHint");
  const floors = s?.onsiteFloors ?? 0;

  const stats: OverviewStat[] = [
    { label: t("visitorsToday"), value: v(s?.visitorsToday), hint: trend },
    { label: t("expected"), value: v(s?.expected) },
    {
      label: tBar("awaiting"),
      value: v(awaiting),
      hint: awaitingHint,
      // The hero only for roles that can act on it.
      tone: canApprove ? "warning" : "default",
    },
    {
      label: t("onsite"),
      value: v(s?.onsite),
      hint: floors > 0 ? tBar("onsiteFloors", { count: floors }) : undefined,
    },
    { label: t("checkedOut"), value: v(s?.checkedOutToday) },
  ];

  // Each admin role has its own console name; anything else keeps the
  // generic "Admin Console · <role>".
  const consoleKey = `console.${activeRole ?? ""}` as "console.ADMIN";
  const eyebrow = tBar.has(consoleKey)
    ? tBar(consoleKey)
    : tV2("eyebrow", {
        role: activeRole ? roleLabel(tRoles, activeRole) : "",
      });

  return {
    query: q,
    stats,
    pendingCount: awaiting,
    eyebrow,
    welcome: tV2("welcome", { name: user?.fullName ?? "" }),
  };
}
