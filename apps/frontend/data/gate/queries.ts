import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GateVerifySource } from "@vms/contracts";
import { useObjectUrl } from "@/data/desk-qr/queries";
import { gateApi, gateKioskApi, type GateKiosk } from "./gate.api";

export function useGateKioskOpen(token: string | null) {
  return useQuery({
    queryKey: ["gate", "open", token],
    queryFn: () => gateApi.open(token as string),
    enabled: !!token,
    // A dead link stays dead; don't hammer the rate limit retrying it.
    retry: false,
  });
}

export function useGateVerify(token: string) {
  return useMutation({
    mutationFn: ({
      code,
      source,
    }: {
      code: string;
      source: GateVerifySource;
    }) => gateApi.verify(token, code, source),
  });
}

const KIOSK_KEY = ["gate-kiosk"] as const;

export function useGateKioskLink() {
  return useQuery({ queryKey: KIOSK_KEY, queryFn: () => gateKioskApi.get() });
}

/** Keyed on the link URL so a rotation loads the new QR. */
export function useGateKioskImage(url: string | undefined) {
  const query = useQuery({
    queryKey: [...KIOSK_KEY, "image", url] as const,
    queryFn: () => gateKioskApi.image(),
    enabled: Boolean(url),
    staleTime: Infinity,
    gcTime: 60_000,
  });
  return { data: useObjectUrl(query.data), isError: query.isError };
}

function useKioskAction(fn: () => Promise<GateKiosk>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (view) => qc.setQueryData(KIOSK_KEY, view),
  });
}

export const useCreateGateKiosk = () =>
  useKioskAction(() => gateKioskApi.create());
export const useRotateGateKiosk = () =>
  useKioskAction(() => gateKioskApi.rotate());
export const useDisableGateKiosk = () =>
  useKioskAction(() => gateKioskApi.disable());
export const useEnableGateKiosk = () =>
  useKioskAction(() => gateKioskApi.enable());
