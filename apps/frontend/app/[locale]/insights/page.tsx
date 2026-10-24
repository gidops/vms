"use client";

import { EmptyState, SegmentedControl, TopNavShell } from "@vms/ui";
import { ChartColumn } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { EvacuationRollScreen } from "@/app/[locale]/_components/EvacuationRollScreen";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";
import { RouteGuard } from "@/shared/auth/RouteGuard";
import { AnalyticsTab } from "./_components/AnalyticsTab";
import { HistoryTab } from "./_components/HistoryTab";
import { INSIGHTS_TABS, type InsightsTab } from "./_components/tabs";
import { OverviewTab } from "./_components/OverviewTab";
import { VisitorsTab } from "./_components/VisitorsTab";

/**
 * Insights: one page for every role, its tabs and their scope set by the
 * caller's permissions (see `_components/tabs.ts`). The tab lives in `?tab=`
 * so links and the old /help and admin routes land on it.
 */
function Insights() {
  const t = useTranslations("insights");
  const { hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const requested = useSearchParams().get("tab");

  const tabs = INSIGHTS_TABS.filter((tab) => tab.anyOf.some(hasPermission));
  const tab: InsightsTab | undefined =
    tabs.find((item) => item.value === requested)?.value ?? tabs[0]?.value;

  return (
    <TopNavShell nav={<AppTopNav centerLabel={t("title")} />}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold text-primary">{t("title")}</h1>
          {tabs.length > 1 && tab ? (
            <div className="max-w-full overflow-x-auto">
              <SegmentedControl
                aria-label={t("title")}
                value={tab}
                onValueChange={(v) =>
                  router.replace({ pathname, query: { tab: v } })
                }
                options={tabs.map((item) => ({
                  value: item.value,
                  label: t(`tabs.${item.value}`),
                }))}
              />
            </div>
          ) : null}
        </div>

        {tab === undefined ? (
          <EmptyState icon={ChartColumn} title={t("nothingHere")} />
        ) : null}
        {tab === "overview" ? <OverviewTab /> : null}
        {tab === "evacuation" ? (
          <EvacuationRollScreen headingLevel={2} />
        ) : null}
        {tab === "history" ? <HistoryTab /> : null}
        {tab === "visitors" ? <VisitorsTab /> : null}
        {tab === "analytics" ? <AnalyticsTab /> : null}
      </div>
    </TopNavShell>
  );
}

export default function InsightsPage() {
  return (
    <RouteGuard>
      <React.Suspense>
        <Insights />
      </React.Suspense>
    </RouteGuard>
  );
}
