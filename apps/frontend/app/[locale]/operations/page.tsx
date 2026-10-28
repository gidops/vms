"use client";

import { EmptyState, SegmentedControl, TopNavShell } from "@vms/ui";
import { Wrench } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { DeskQrScreen } from "@/app/[locale]/_components/DeskQrScreen";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";
import { RouteGuard } from "@/shared/auth/RouteGuard";
import { AccessCardsTab } from "./_components/access-cards/AccessCardsTab";
import { AuditTrailTab } from "./_components/AuditTrailTab";
import { GateKioskTab } from "./_components/GateKioskTab";
import { OPERATIONS_TABS, type OperationsTab } from "./_components/tabs";

/** Each tab shows with its permission; the tab lives in `?tab=` so links land on it. */
function Operations() {
  const t = useTranslations("operations");
  const { hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const requested = useSearchParams().get("tab");

  const tabs = OPERATIONS_TABS.filter((tab) => hasPermission(tab.permission));
  const tab: OperationsTab | undefined =
    tabs.find((item) => item.value === requested)?.value ?? tabs[0]?.value;

  return (
    <TopNavShell nav={<AppTopNav centerLabel={t("title")} />}>
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold text-fg">{t("title")}</h1>

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
          <EmptyState icon={Wrench} title={t("noAccess")} />
        ) : null}
        {tab === "accessCards" ? <AccessCardsTab /> : null}
        {tab === "deskQr" ? (
          <DeskQrScreen headingLevel={2} showHeading={false} />
        ) : null}
        {tab === "gateKiosk" ? <GateKioskTab /> : null}
        {tab === "audit" ? <AuditTrailTab /> : null}
      </div>
    </TopNavShell>
  );
}

export default function OperationsPage() {
  return (
    <RouteGuard>
      <React.Suspense>
        <Operations />
      </React.Suspense>
    </RouteGuard>
  );
}
