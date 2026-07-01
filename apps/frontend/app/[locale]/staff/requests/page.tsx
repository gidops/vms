"use client";

import { RequestsAlertsScreen } from "@/app/[locale]/_components/RequestsAlertsScreen";
import { RouteGuard } from "@/shared/auth/RouteGuard";

export default function StaffRequestsPage() {
  return (
    <RouteGuard home="/staff">
      <RequestsAlertsScreen app="staff" scope="mine" />
    </RouteGuard>
  );
}
