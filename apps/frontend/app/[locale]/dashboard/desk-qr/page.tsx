"use client";

import { PERMISSIONS } from "@vms/contracts";
import { TopNavShell } from "@vms/ui";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { DeskQrScreen } from "@/app/[locale]/_components/DeskQrScreen";
import { PermissionGate } from "@/shared/auth/PermissionGate";
import { RouteGuard } from "@/shared/auth/RouteGuard";

/** /dashboard mount of the shared DeskQrScreen (reception). */
export default function VmcDeskQrPage() {
  return (
    <RouteGuard home="/dashboard">
      <TopNavShell nav={<AppTopNav />}>
        <PermissionGate permission={PERMISSIONS.ISSUER_READ}>
          <DeskQrScreen />
        </PermissionGate>
      </TopNavShell>
    </RouteGuard>
  );
}
