import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { DeskQrView } from "@vms/contracts";
import { deskQrApi } from "./desk-qr.api";

const KEY = ["desk-qr"] as const;

export function useDeskQr() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => deskQrApi.get(),
    // Keeps "Scans today" moving while reception has the page open.
    refetchInterval: 60_000,
  });
}

/**
 * The QR picture as an object URL. Keyed on the printed URL, so New QR loads
 * the new picture; the URL is revoked when it is replaced or unused.
 */
export function useDeskQrImage(qrUrl: string | undefined) {
  return useQuery({
    queryKey: [...KEY, "image", qrUrl] as const,
    queryFn: async () => URL.createObjectURL(await deskQrApi.image()),
    enabled: Boolean(qrUrl),
    staleTime: Infinity,
    gcTime: 60_000,
  });
}

const store = (qc: QueryClient) => (view: DeskQrView) =>
  qc.setQueryData(KEY, view);

/** Create / change email / New QR / Disable / Enable all return the new view. */
export function useDeskQrAction<A>(fn: (arg: A) => Promise<DeskQrView>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: store(qc) });
}

export function useDownloadDeskQr() {
  return useMutation({ mutationFn: () => deskQrApi.downloadPng() });
}
