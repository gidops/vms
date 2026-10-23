"use client";

import { PERMISSIONS } from "@vms/contracts";
import { TopNavShell } from "@vms/ui";
import { DeskQrScreen } from "@/app/[locale]/_components/DeskQrScreen";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { PermissionGate } from "@/shared/auth/PermissionGate";
import { RouteGuard } from "@/shared/auth/RouteGuard";

/** Admin console v2 — Desk QR tab: the shared staff/VMC screen. */
export default function AdminV2DeskQrPage() {
  return (
    <RouteGuard home="/admin">
      <TopNavShell nav={<AppTopNav app="admin" active="deskQr" />}>
        <PermissionGate permission={PERMISSIONS.ISSUER_READ}>
          <DeskQrScreen />
        </PermissionGate>
      </TopNavShell>
    </RouteGuard>
  );
}
