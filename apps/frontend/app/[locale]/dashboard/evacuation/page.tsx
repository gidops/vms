"use client";

import { PERMISSIONS } from "@vms/contracts";
import { TopNavShell } from "@vms/ui";
import { useTranslations } from "next-intl";
import { EvacuationRollScreen } from "@/app/[locale]/_components/EvacuationRollScreen";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { PermissionGate } from "@/shared/auth/PermissionGate";
import { RouteGuard } from "@/shared/auth/RouteGuard";

/** /dashboard mount of the shared EvacuationRollScreen (RouteGuard keeps this role out of /admin). */
export default function VmcEvacuationPage() {
  const t = useTranslations("evacuation");
  return (
    <RouteGuard home="/dashboard">
      <TopNavShell nav={<AppTopNav centerLabel={t("title")} />}>
        <PermissionGate permission={PERMISSIONS.EVACUATION_READ}>
          <EvacuationRollScreen />
        </PermissionGate>
      </TopNavShell>
    </RouteGuard>
  );
}
