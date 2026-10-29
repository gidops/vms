"use client";

import { PERMISSIONS } from "@vms/contracts";
import { ShieldCheck } from "lucide-react";
import { useNow, useTranslations } from "next-intl";
import type { OverviewStat } from "@/app/[locale]/_components/OverviewBar";
import { countOverdue } from "@/app/[locale]/admin/_components/pendingApprovals";
import { useAdminOverviewStats, useApprovalQueue } from "@/data/admin/queries";
import { useAuth } from "@/shared/auth/AuthContext";
import { roleLabel } from "@/shared/auth/roleLabels";
import {
  adminConsoleRole,
  type AdminConsoleRole,
} from "@/shared/auth/adminConsoleRole";

export type BandStatKey =
  | "visitorsToday"
  | "awaiting"
  | "onsite"
  | "expected"
  | "checkedOut";

/** The Security Manager leads with pending work; the System Admin watches traffic. */
export function bandStatKeys(role: AdminConsoleRole): BandStatKey[] {
  return role === "securityManager"
    ? ["awaiting", "onsite", "expected"]
    : ["visitorsToday", "onsite", "checkedOut"];
}

/** Overview band copy and the console's three headline stats. */
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

  const role = adminConsoleRole(hasPermission);
  const sm = role === "securityManager";
  const all: Record<BandStatKey, OverviewStat> = {
    visitorsToday: {
      label: t("visitorsToday"),
      value: v(s?.visitorsToday),
      hint: trend,
    },
    awaiting: {
      label: tBar("awaiting"),
      value: v(awaiting),
      hint: awaitingHint,
      // The hero only for roles that can act on it.
      tone: canApprove ? "warning" : "default",
      link: sm
        ? { href: "/admin/approvals", label: tV2("openApprovals") }
        : undefined,
    },
    onsite: {
      // The Security Manager's band reads "Onsite now", like the v1 console.
      label: sm ? tBar("onsite") : t("onsite"),
      value: v(s?.onsite),
      hint: floors > 0 ? tBar("onsiteFloors", { count: floors }) : undefined,
    },
    expected: {
      label: tBar("expected"),
      value: v(s?.expected),
      hint: tBar("expectedHint"),
    },
    checkedOut: { label: t("checkedOut"), value: v(s?.checkedOutToday) },
  };
  const stats = bandStatKeys(role).map((key) => all[key]);

  // Unknown roles fall back to the generic console name.
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
    // Both consoles share the shield; the eyebrow text tells them apart.
    eyebrowIcon: ShieldCheck,
    welcome: tV2("welcome", { name: user?.fullName ?? "" }),
  };
}
