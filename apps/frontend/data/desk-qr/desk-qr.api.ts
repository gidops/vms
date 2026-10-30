import type {
  DeskQrFormSession,
  DeskQrView,
  PublicHostOption,
  PublicRegistrationInput,
  PublicRegistrationResult,
} from "@vms/contracts";
import { api, apiBlob, apiDownload } from "@/data/http/client";

/** Reception and admins: the one VMC desk QR. */
export const deskQrApi = {
  /** `null` until the desk QR has been created. */
  async get(): Promise<DeskQrView | null> {
    return (await api<DeskQrView | null>(`/desk-qr`)) ?? null;
  },
  create() {
    return api<DeskQrView>(`/desk-qr`, { method: "POST" });
  },
  rotate() {
    return api<DeskQrView>(`/desk-qr/rotate`, { method: "POST" });
  },
  disable() {
    return api<DeskQrView>(`/desk-qr/disable`, { method: "POST" });
  },
  enable() {
    return api<DeskQrView>(`/desk-qr/enable`, { method: "POST" });
  },
  /** The QR as an image for the card and the print poster. */
  async image(size = 1024): Promise<Blob> {
    return (await apiBlob(`/desk-qr/qr.png?size=${size}`)).blob;
  },
  downloadPng() {
    return apiDownload(`/desk-qr/qr.png?size=1024`, "aatc-desk-qr.png");
  },
};

const pub = (token: string) => `/public/desk-qr/${encodeURIComponent(token)}`;

/** The visitor's self-registration (no login). */
export const publicRegistrationApi = {
  open(token: string) {
    return api<DeskQrFormSession>(pub(token), { auth: false });
  },
  searchHosts(token: string, q: string, formToken: string) {
    const query = new URLSearchParams({ q, formToken });
    return api<PublicHostOption[]>(`${pub(token)}/hosts?${query}`, {
      auth: false,
    });
  },
  submit(token: string, input: PublicRegistrationInput) {
    return api<PublicRegistrationResult>(`${pub(token)}/registrations`, {
      method: "POST",
      body: input,
      auth: false,
    });
  },
};
