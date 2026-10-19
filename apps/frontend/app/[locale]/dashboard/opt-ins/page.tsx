"use client";

import { PERMISSIONS } from "@vms/contracts";
import { TopNavShell } from "@vms/ui";
import { CommsOptInsScreen } from "@/app/[locale]/_components/CommsOptInsScreen";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { PermissionGate } from "@/shared/auth/PermissionGate";
import { RouteGuard } from "@/shared/auth/RouteGuard";

/** /dashboard mount of the shared CommsOptInsScreen (RouteGuard keeps this role out of /admin). */
export default function VmcOptInsPage() {
  return (
    <RouteGuard home="/dashboard">
      <TopNavShell nav={<AppTopNav />}>
        <PermissionGate permission={PERMISSIONS.CONSENT_READ}>
          <CommsOptInsScreen />
        </PermissionGate>
      </TopNavShell>
    </RouteGuard>
  );
}
