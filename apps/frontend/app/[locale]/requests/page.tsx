"use client";

import { RequestsAlertsScreen } from "@/app/[locale]/_components/RequestsAlertsScreen";
import { RouteGuard } from "@/shared/auth/RouteGuard";

export default function RequestsPage() {
  return (
    <RouteGuard home="/dashboard">
      <RequestsAlertsScreen app="vmc" scope="all" />
    </RouteGuard>
  );
}
