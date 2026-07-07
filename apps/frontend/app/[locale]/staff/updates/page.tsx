"use client";

import { StaffUpdatesScreen } from "@/app/[locale]/staff/_components/StaffUpdatesScreen";
import { RouteGuard } from "@/shared/auth/RouteGuard";

export default function StaffUpdatesPage() {
  return (
    <RouteGuard home="/staff">
      <StaffUpdatesScreen />
    </RouteGuard>
  );
}
