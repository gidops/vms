"use client";

import * as React from "react";
import { useGateKioskOpen } from "@/data/gate/queries";
import { useRouter } from "@/i18n/navigation";
import { rememberKioskToken } from "@/shared/gateKioskToken";
import { GateKioskApp } from "../_components/GateKioskApp";

/**
 * Opening the kiosk link sets the device up: once the link checks out it is
 * remembered and the address becomes plain `/gate`, so the token is not left
 * on screen. Without storage the kiosk simply keeps running from this URL.
 */
export function GateLinkLanding({ token }: { token: string }) {
  const router = useRouter();
  const open = useGateKioskOpen(token);

  React.useEffect(() => {
    if (open.isSuccess && rememberKioskToken(token)) router.replace("/gate");
  }, [open.isSuccess, token, router]);

  return <GateKioskApp token={token} />;
}
