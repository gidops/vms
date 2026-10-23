"use client";

import { PERMISSIONS } from "@vms/contracts";
import { EvacuationRollScreen } from "@/app/[locale]/_components/EvacuationRollScreen";
import { AdminShell } from "@/app/[locale]/admin/_components/AdminShell";
import { PermissionGate } from "@/shared/auth/PermissionGate";
import { RouteGuard } from "@/shared/auth/RouteGuard";

/** Admin console mount of the shared EvacuationRollScreen. */
export default function AdminEvacuationPage() {
  return (
    <RouteGuard home="/admin">
      <AdminShell active="evacuation">
        <PermissionGate permission={PERMISSIONS.EVACUATION_READ}>
          <EvacuationRollScreen />
        </PermissionGate>
      </AdminShell>
    </RouteGuard>
  );
}
