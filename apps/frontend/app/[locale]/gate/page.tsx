"use client";

import * as React from "react";
import { readKioskToken } from "@/shared/gateKioskToken";
import { GateKioskApp } from "./_components/GateKioskApp";

const noSubscribe = () => () => {};

/**
 * Gate kiosk (no login, no RouteGuard): runs with the kiosk link this device
 * remembered when it first opened `/gate/<token>`.
 */
export default function GatePage() {
  // `undefined` while rendering on the server, before the device is known.
  const token = React.useSyncExternalStore(
    noSubscribe,
    readKioskToken,
    () => undefined,
  );
  return <GateKioskApp token={token} />;
}
