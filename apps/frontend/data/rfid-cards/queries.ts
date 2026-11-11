import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  CloseRfidAssignmentInput,
  SetRfidCardStatusInput,
} from "@vms/contracts";
import { staleKeysFor } from "@/data/live/invalidation";
import {
  rfidCardsApi,
  type AssignCardBody,
  type AssignmentListParams,
  type CardListParams,
} from "./rfid-cards.api";

const KEY = ["rfid-cards"] as const;

export function useRfidAssignments(params: AssignmentListParams) {
  return useQuery({
    queryKey: [...KEY, "assignments", params] as const,
    queryFn: () => rfidCardsApi.assignments(params),
    placeholderData: keepPreviousData,
  });
}

export function useRfidAssignment(id: string | null) {
  return useQuery({
    queryKey: [...KEY, "assignment", id] as const,
    queryFn: () => rfidCardsApi.assignment(id!),
    enabled: !!id,
  });
}

export function useRfidCards(params: CardListParams) {
  return useQuery({
    queryKey: [...KEY, "cards", params] as const,
    queryFn: () => rfidCardsApi.cards(params),
    placeholderData: keepPreviousData,
  });
}

/** Every write refreshes the card lists and detail, the visits holding a card, and the audit trail. */
function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    for (const queryKey of staleKeysFor("rfid_card.")) {
      void qc.invalidateQueries({ queryKey });
    }
  };
}

export function useAssignRfidCard() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: AssignCardBody) => rfidCardsApi.assign(body),
    onSuccess: invalidate,
  });
}

export function useUpdateRfidAssignment(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: {
      validUntil?: string;
      photoKey?: string;
      notes?: string;
    }) => rfidCardsApi.update(id, body),
    onSuccess: invalidate,
  });
}

export function useMarkRfidPrinted() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => rfidCardsApi.printed(id),
    onSuccess: invalidate,
  });
}

export function useCloseRfidAssignment(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: CloseRfidAssignmentInput) =>
      rfidCardsApi.close(id, body),
    onSuccess: invalidate,
  });
}

export function useSetRfidCardStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: SetRfidCardStatusInput & { id: string }) =>
      rfidCardsApi.setCardStatus(id, body),
    onSuccess: invalidate,
  });
}
