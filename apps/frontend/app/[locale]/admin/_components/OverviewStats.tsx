"use client";

import { StatCard, type StatCardProps } from "@vms/ui";
import {
  ChevronRight,
  CircleCheck,
  CircleUserRound,
  Clock,
  LogOut,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AdminOverviewStats } from "@/data/admin/queries";

function DetailLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="-m-1 rounded p-1 text-fg-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      <ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden="true" />
    </Link>
  );
}

/**
 * The five headline metrics. Only metrics with a built detail view get a
 * chevron link (pending → the approval queue); the filtered visitor views from
 * the design come with the Visitors section.
 */
export function OverviewStats({
  stats,
  loading,
}: {
  stats: AdminOverviewStats;
  loading: boolean;
}) {
  const t = useTranslations("admin.overview.stats");
  const value = (n: number) => (loading ? "—" : n);

  const delta = stats.visitorsToday - stats.visitorsYesterday;
  const visitorsTrend: StatCardProps["trend"] =
    loading || delta === 0
      ? undefined
      : {
          value: Math.abs(delta),
          direction: delta > 0 ? "up" : "down",
          label: t("fromYesterday"),
        };

  const cards: StatCardProps[] = [
    {
      label: t("visitorsToday"),
      value: value(stats.visitorsToday),
      icon: Users,
      tone: "success",
      trend: visitorsTrend,
      hint: visitorsTrend ? undefined : t("sameAsYesterday"),
    },
    {
      label: t("expected"),
      value: value(stats.expected),
      icon: CircleCheck,
      tone: "success",
      hint: t("expectedHint"),
    },
    {
      label: t("pending"),
      value: value(stats.pending),
      icon: Clock,
      tone: "warning",
      hint: t("pendingHint", { count: stats.reviewRequested }),
      action: <DetailLink href="/admin/requests" label={t("openPending")} />,
    },
    {
      label: t("onsite"),
      value: value(stats.onsite),
      icon: CircleUserRound,
      tone: "info",
      hint: t("onsiteHint"),
    },
    {
      label: t("checkedOut"),
      value: value(stats.checkedOutToday),
      icon: LogOut,
      tone: "neutral",
      hint: t("checkedOutHint"),
    },
  ];

  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
      aria-busy={loading || undefined}
    >
      {cards.map((card) => (
        <StatCard key={card.label} layout="stacked" {...card} />
      ))}
    </div>
  );
}
