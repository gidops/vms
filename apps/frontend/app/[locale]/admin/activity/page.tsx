"use client";

import { RequestsAlertsScreen } from "@/app/[locale]/_components/RequestsAlertsScreen";
import { RouteGuard } from "@/shared/auth/RouteGuard";

/** Complete request/alert inbox; opening it acknowledges the unread feed. */
export default function AdminActivityPage() {
  return (
    <RouteGuard home="/admin">
      <RequestsAlertsScreen admin />
    </RouteGuard>
  );
}
