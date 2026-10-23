"use client";

import { PERMISSIONS } from "@vms/contracts";
import { TopNavShell } from "@vms/ui";
import { EvacuationRollScreen } from "@/app/[locale]/_components/EvacuationRollScreen";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { PermissionGate } from "@/shared/auth/PermissionGate";
import { RouteGuard } from "@/shared/auth/RouteGuard";

/** Admin console v2 — Evacuation Roll tab: the shared staff/VMC screen. */
export default function AdminV2EvacuationPage() {
  return (
    <RouteGuard home="/admin">
      <TopNavShell nav={<AppTopNav app="admin" active="evacuation" />}>
        <PermissionGate permission={PERMISSIONS.EVACUATION_READ}>
          <EvacuationRollScreen />
        </PermissionGate>
      </TopNavShell>
    </RouteGuard>
  );
}
