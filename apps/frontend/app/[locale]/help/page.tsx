"use client";

import { PERMISSIONS } from "@vms/contracts";
import { Button, SegmentedControl, TopNavShell } from "@vms/ui";
import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { CommsOptInsScreen } from "@/app/[locale]/_components/CommsOptInsScreen";
import { DeskQrScreen } from "@/app/[locale]/_components/DeskQrScreen";
import { EvacuationRollScreen } from "@/app/[locale]/_components/EvacuationRollScreen";
import { ExportVisitorsDialog } from "@/app/[locale]/_components/ExportVisitorsDialog";
import { SettingsRow } from "@/app/[locale]/_components/SettingsRow";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";
import { RouteGuard } from "@/shared/auth/RouteGuard";

/** Tabs in display order; `null` permission = shown to everyone. */
const TABS = [
  { value: "evacuation", permission: PERMISSIONS.EVACUATION_READ },
  { value: "optIns", permission: PERMISSIONS.CONSENT_READ },
  { value: "deskQr", permission: PERMISSIONS.ISSUER_READ },
  { value: "export", permission: PERMISSIONS.REPORT_EXPORT },
  { value: "support", permission: null },
] as const;

type Tab = (typeof TABS)[number]["value"];

function ExportTab() {
  const t = useTranslations("help.export");
  const [open, setOpen] = React.useState(false);
  return (
    <SettingsRow title={t("title")} description={t("help")}>
      <div>
        <Button onClick={() => setOpen(true)}>
          <Download className="size-4" aria-hidden="true" />
          {t("button")}
        </Button>
      </div>
      <ExportVisitorsDialog open={open} onOpenChange={setOpen} />
    </SettingsRow>
  );
}

function SupportTab() {
  const t = useTranslations("help.support");
  return (
    <SettingsRow title={t("title")}>
      <p className="text-fg">{t("message")}</p>
    </SettingsRow>
  );
}

/**
 * Help/Support: the VMC team's admin area (Evacuation Roll, Comms Opt-ins,
 * Desk QR, Export Data), plus where to get help. Each admin tab shows only with
 * its permission, so roles without any just see Help & Support. The tab lives
 * in `?tab=` so links (and the old /dashboard/* redirects) land on it.
 */
function Help() {
  const t = useTranslations("help");
  const { hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const requested = useSearchParams().get("tab");

  const tabs = TABS.filter(
    (tab) => tab.permission === null || hasPermission(tab.permission),
  );
  const tab: Tab =
    tabs.find((item) => item.value === requested)?.value ?? tabs[0].value;

  return (
    <TopNavShell nav={<AppTopNav centerLabel={t("title")} />}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <h1 className="text-3xl font-semibold text-fg">{t("title")}</h1>

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

        {tab === "evacuation" ? (
          <EvacuationRollScreen headingLevel={2} />
        ) : null}
        {tab === "optIns" ? <CommsOptInsScreen headingLevel={2} /> : null}
        {tab === "deskQr" ? <DeskQrScreen headingLevel={2} /> : null}
        {tab === "export" ? <ExportTab /> : null}
        {tab === "support" ? <SupportTab /> : null}
      </div>
    </TopNavShell>
  );
}

export default function HelpPage() {
  return (
    <RouteGuard>
      <React.Suspense>
        <Help />
      </React.Suspense>
    </RouteGuard>
  );
}
