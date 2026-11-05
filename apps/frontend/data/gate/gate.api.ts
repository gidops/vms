import type {
  GateKioskView,
  GateVerifyResult,
  GateVerifySource,
  GateVisitSummary,
} from "@vms/contracts";
import { api, apiBlob } from "@/data/http/client";
import type { Wire } from "@/data/insights/insights.api";

export type GateResult = Wire<GateVerifyResult>;
export type GateVisit = Wire<GateVisitSummary>;
export type GateKiosk = Wire<GateKioskView>;

const pub = (token: string) => `/public/gate/${encodeURIComponent(token)}`;

/** The kiosk device (no login): the kiosk link's token is the only credential. */
export const gateApi = {
  /** Resolves for a live link; 404 when unknown, rotated or disabled. */
  open(token: string): Promise<{ active: true }> {
    return api<{ active: true }>(pub(token), { auth: false });
  },
  /** Checks an invitation code against today's visits; every call is logged. */
  verify(
    token: string,
    code: string,
    source: GateVerifySource,
  ): Promise<GateResult> {
    return api<GateResult>(`${pub(token)}/verify`, {
      method: "POST",
      body: { code, source },
      auth: false,
    });
  },
};

/** System Admin: the one gate kiosk link (Operations → Gate kiosk). */
export const gateKioskApi = {
  /** `null` until the link has been created. */
  async get(): Promise<GateKiosk | null> {
    return (await api<GateKiosk | null>(`/gate-kiosk`)) ?? null;
  },
  create() {
    return api<GateKiosk>(`/gate-kiosk`, { method: "POST" });
  },
  rotate() {
    return api<GateKiosk>(`/gate-kiosk/rotate`, { method: "POST" });
  },
  disable() {
    return api<GateKiosk>(`/gate-kiosk/disable`, { method: "POST" });
  },
  enable() {
    return api<GateKiosk>(`/gate-kiosk/enable`, { method: "POST" });
  },
  /** QR of the kiosk link, to open it with the device's camera. */
  async image(size = 512): Promise<Blob> {
    return (await apiBlob(`/gate-kiosk/qr.png?size=${size}`)).blob;
  },
};
