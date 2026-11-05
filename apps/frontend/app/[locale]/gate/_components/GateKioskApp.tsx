"use client";

import * as React from "react";
import { ApiError } from "@/data/http/client";
import { useGateKioskOpen } from "@/data/gate/queries";
import { GateKiosk } from "./GateKiosk";
import { KioskHeader } from "./KioskHeader";
import { KioskStatus } from "./KioskStatus";

/**
 * The kiosk page for a device link token (`null` = this device has none).
 * The link is checked up front, and again by every scan: once it is rotated or
 * disabled the kiosk says so instead of scanning.
 */
export function GateKioskApp({ token }: { token: string | null | undefined }) {
  const open = useGateKioskOpen(token ?? null);
  const [revoked, setRevoked] = React.useState(false);

  let body: React.ReactNode;
  if (token === undefined || (token && open.isLoading)) {
    body = <KioskStatus kind="checking" />;
  } else if (!token) {
    body = <KioskStatus kind="notSetUp" />;
  } else if (
    revoked ||
    (open.error instanceof ApiError && open.error.status === 404)
  ) {
    body = <KioskStatus kind="inactive" />;
  } else {
    body = (
      <div className="w-full px-4 py-6 sm:px-6">
        <GateKiosk token={token} onRevoked={() => setRevoked(true)} />
      </div>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-canvas">
      <KioskHeader />
      {body}
    </main>
  );
}
