"use client";

import { PERMISSIONS } from "@vms/contracts";
import { TopNavShell } from "@vms/ui";
import { useTranslations } from "next-intl";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { DeskQrScreen } from "@/app/[locale]/_components/DeskQrScreen";
import { PermissionGate } from "@/shared/auth/PermissionGate";
import { RouteGuard } from "@/shared/auth/RouteGuard";

/** /dashboard mount of the shared DeskQrScreen (reception). */
export default function VmcDeskQrPage() {
  const t = useTranslations("deskQr");
  return (
    <RouteGuard home="/dashboard">
      <TopNavShell nav={<AppTopNav centerLabel={t("title")} />}>
        <PermissionGate permission={PERMISSIONS.ISSUER_READ}>
          <DeskQrScreen />
        </PermissionGate>
      </TopNavShell>
    </RouteGuard>
  );
}
