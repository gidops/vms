"use client";

import { useTranslations } from "next-intl";
import type { OverviewStat } from "@/app/[locale]/_components/OverviewBar";
import { useAdminOverviewStats } from "@/data/admin/queries";
import { useAuth } from "@/shared/auth/AuthContext";
import { roleLabel } from "@/shared/auth/roleLabels";

/**
 * Data for the admin overview band: the eyebrow/welcome copy and the five
 * headline stats (formerly the `StatCard` grid). "Visitors Today" carries the
 * vs-yesterday trend as its sub-line.
 */
export function useAdminBand() {
  const t = useTranslations("admin.overview.stats");
  const tV2 = useTranslations("adminV2.overview");
  const tRoles = useTranslations("roles");
  const { user, activeRole } = useAuth();
  const q = useAdminOverviewStats();
  const s = q.data;
  const v = (n: number | undefined) => n ?? "—";

  const delta = s ? s.visitorsToday - s.visitorsYesterday : 0;
  const trend = !s
    ? undefined
    : delta === 0
      ? t("sameAsYesterday")
      : tV2(delta > 0 ? "trendUp" : "trendDown", { count: Math.abs(delta) });

  const stats: OverviewStat[] = [
    { label: t("visitorsToday"), value: v(s?.visitorsToday), hint: trend },
    { label: t("expected"), value: v(s?.expected) },
    { label: t("pending"), value: v(s?.pending) },
    { label: t("onsite"), value: v(s?.onsite) },
    { label: t("checkedOut"), value: v(s?.checkedOutToday) },
  ];

  return {
    query: q,
    stats,
    pendingCount: s?.pending,
    eyebrow: tV2("eyebrow", {
      role: activeRole ? roleLabel(tRoles, activeRole) : "",
    }),
    welcome: tV2("welcome", { name: user?.fullName ?? "" }),
  };
}
