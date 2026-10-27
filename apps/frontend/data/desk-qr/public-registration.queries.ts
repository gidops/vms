import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  DeskQrFormSession,
  PublicRegistrationInput,
  PublicRegistrationPending,
} from "@vms/contracts";
import { publicRegistrationApi } from "./desk-qr.api";

/** A response stamped with `performance.now()` on arrival, so countdowns never read the phone's wall clock. */
export type Timed<T> = T & { receivedAt: number };

const stamp = async <T>(p: Promise<T>): Promise<Timed<T>> => {
  const data = await p;
  return { ...data, receivedAt: performance.now() };
};

/** `attempt` changes on "Start again" so each try opens a fresh form. */
export function useDeskQrSession(token: string, attempt = 0) {
  return useQuery<Timed<DeskQrFormSession>>({
    queryKey: ["desk-qr-form", token, attempt],
    queryFn: () => stamp(publicRegistrationApi.open(token)),
    // 404/410 are answers, not glitches; a retry would only delay them.
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function usePublicHostSearch(
  token: string,
  q: string,
  formToken: string,
) {
  return useQuery({
    queryKey: ["public-hosts", token, q],
    queryFn: () => publicRegistrationApi.searchHosts(token, q, formToken),
    enabled: q.length >= 3,
    staleTime: 60_000,
  });
}

export function useSubmitRegistration(token: string) {
  return useMutation<
    Timed<PublicRegistrationPending>,
    unknown,
    PublicRegistrationInput
  >({
    mutationFn: (input) => stamp(publicRegistrationApi.submit(token, input)),
  });
}

export function useVerifyRegistration(token: string) {
  return useMutation({
    mutationFn: ({
      registrationId,
      code,
    }: {
      registrationId: string;
      code: string;
    }) => publicRegistrationApi.verify(token, registrationId, code),
  });
}
