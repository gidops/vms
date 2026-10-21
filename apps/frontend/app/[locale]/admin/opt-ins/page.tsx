"use client";

import { PERMISSIONS } from "@vms/contracts";
import { CommsOptInsScreen } from "@/app/[locale]/_components/CommsOptInsScreen";
import { AdminShell } from "@/app/[locale]/admin/_components/AdminShell";
import { PermissionGate } from "@/shared/auth/PermissionGate";
import { RouteGuard } from "@/shared/auth/RouteGuard";

/** Admin console mount of the shared CommsOptInsScreen. */
export default function AdminOptInsPage() {
  return (
    <RouteGuard home="/admin">
      <AdminShell active="optIns">
        <PermissionGate permission={PERMISSIONS.CONSENT_READ}>
          <CommsOptInsScreen />
        </PermissionGate>
      </AdminShell>
    </RouteGuard>
  );
}
