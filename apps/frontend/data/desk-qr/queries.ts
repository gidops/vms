import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeskQrView } from "@vms/contracts";
import * as React from "react";
import { saveBlob } from "@/data/http/client";
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

/** An object URL for `blob`, revoked when the blob changes or the component unmounts. */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const url = React.useMemo(
    () => (blob ? URL.createObjectURL(blob) : undefined),
    [blob],
  );
  React.useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}

/** Keyed on the printed URL so New QR loads the new picture. */
export function useDeskQrImage(qrUrl: string | undefined) {
  const query = useQuery({
    queryKey: [...KEY, "image", qrUrl] as const,
    queryFn: () => deskQrApi.image(),
    enabled: Boolean(qrUrl),
    staleTime: Infinity,
    gcTime: 60_000,
  });
  return {
    data: useObjectUrl(query.data),
    blob: query.data,
    isError: query.isError,
  };
}

/** Saves the QR picture already loaded for the card, without fetching it again. */
export function useDownloadDeskQr() {
  return useMutation({
    mutationFn: async (blob: Blob) => saveBlob(blob, "aatc-desk-qr.png"),
  });
}

function useDeskQrAction<A>(fn: (arg: A) => Promise<DeskQrView>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (view) => qc.setQueryData(KEY, view),
  });
}

export const useCreateDeskQr = () =>
  useDeskQrAction((codeEmail: string) => deskQrApi.create({ codeEmail }));
export const useUpdateDeskQr = () =>
  useDeskQrAction((codeEmail: string) => deskQrApi.update({ codeEmail }));
export const useRotateDeskQr = () => useDeskQrAction(() => deskQrApi.rotate());
export const useDisableDeskQr = () =>
  useDeskQrAction(() => deskQrApi.disable());
export const useEnableDeskQr = () => useDeskQrAction(() => deskQrApi.enable());
