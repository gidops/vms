"use client";

import { PERMISSIONS } from "@vms/contracts";
import { TopNavShell } from "@vms/ui";
import { CommsOptInsScreen } from "@/app/[locale]/_components/CommsOptInsScreen";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { PermissionGate } from "@/shared/auth/PermissionGate";
import { RouteGuard } from "@/shared/auth/RouteGuard";

/** Admin console v2 — Comms Opt-ins tab: the shared staff/VMC screen. */
export default function AdminV2OptInsPage() {
  return (
    <RouteGuard home="/admin">
      <TopNavShell nav={<AppTopNav app="admin" active="optIns" />}>
        <PermissionGate permission={PERMISSIONS.CONSENT_READ}>
          <CommsOptInsScreen />
        </PermissionGate>
      </TopNavShell>
    </RouteGuard>
  );
}
