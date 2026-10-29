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

/** Tabs and their scope come from the caller's permissions; the tab lives in `?tab=` so links land on it. */
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
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-fg md:text-3xl">
          {t("title")}
        </h1>

        {tabs.length > 1 && tab ? (
          <div className="max-w-full overflow-x-auto">
            <SegmentedControl
              className="min-w-full"
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

        {tab === undefined ? (
          <EmptyState icon={ChartColumn} title={t("nothingHere")} />
        ) : null}
        {tab === "overview" ? <OverviewTab /> : null}
        {tab === "evacuation" ? (
          <EvacuationRollScreen headingLevel={2} showHeading={false} />
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
