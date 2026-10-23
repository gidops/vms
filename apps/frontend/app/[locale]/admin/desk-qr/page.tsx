"use client";

import { PERMISSIONS } from "@vms/contracts";
import { DeskQrScreen } from "@/app/[locale]/_components/DeskQrScreen";
import { AdminShell } from "@/app/[locale]/admin/_components/AdminShell";
import { PermissionGate } from "@/shared/auth/PermissionGate";
import { RouteGuard } from "@/shared/auth/RouteGuard";

/** Admin console mount of the shared DeskQrScreen. */
export default function AdminDeskQrPage() {
  return (
    <RouteGuard home="/admin">
      <AdminShell active="deskQr">
        <PermissionGate permission={PERMISSIONS.ISSUER_READ}>
          <DeskQrScreen />
        </PermissionGate>
      </AdminShell>
    </RouteGuard>
  );
}
