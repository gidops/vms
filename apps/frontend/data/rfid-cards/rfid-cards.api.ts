import type {
  AssignRfidCardInput,
  AvatarContentType,
  CloseRfidAssignmentInput,
  RfidAssignmentDetail,
  RfidAssignmentItem,
  RfidCardItem,
  RfidCardStatus,
  SetRfidCardStatusInput,
} from "@vms/contracts";
import { api } from "@/data/http/client";
import type { Wire } from "@/data/insights/insights.api";
import type { Paginated } from "@/data/visits/visits.api";

export type AssignmentItem = Wire<RfidAssignmentItem>;
export type AssignmentDetail = Wire<RfidAssignmentDetail>;
export type CardItem = Wire<RfidCardItem>;

/** What the assign form sends (dates as ISO strings). */
export type AssignCardBody = Wire<AssignRfidCardInput>;

export interface AssignmentListParams {
  view?: "active" | "history";
  cardId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CardListParams {
  status?: RfidCardStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

function query(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const q = qs.toString();
  return q ? `?${q}` : "";
}

/** Operations → Access cards (personalised RFID cards). System Admin only. */
export const rfidCardsApi = {
  assignments(params: AssignmentListParams = {}) {
    return api<Paginated<AssignmentItem>>(
      `/rfid-cards/assignments${query(params)}`,
    );
  },
  assignment(id: string) {
    return api<AssignmentDetail>(`/rfid-cards/assignments/${id}`);
  },
  cards(params: CardListParams = {}) {
    return api<Paginated<CardItem>>(`/rfid-cards${query(params)}`);
  },
  assign(body: AssignCardBody) {
    return api<AssignmentDetail>(`/rfid-cards/assignments`, {
      method: "POST",
      body,
    });
  },
  update(
    id: string,
    body: { validUntil?: string; photoKey?: string; notes?: string },
  ) {
    return api<AssignmentDetail>(`/rfid-cards/assignments/${id}`, {
      method: "PATCH",
      body,
    });
  },
  printed(id: string) {
    return api<AssignmentDetail>(`/rfid-cards/assignments/${id}/printed`, {
      method: "POST",
    });
  },
  close(id: string, body: CloseRfidAssignmentInput) {
    return api<AssignmentDetail>(`/rfid-cards/assignments/${id}/close`, {
      method: "POST",
      body,
    });
  },
  setCardStatus(id: string, body: SetRfidCardStatusInput) {
    return api<void>(`/rfid-cards/${id}/status`, { method: "POST", body });
  },
  /**
   * Upload a visitor photo: presign → PUT straight to S3 (not through api()) →
   * return the key to store on the assignment.
   */
  async uploadPhoto(file: Blob): Promise<string> {
    const contentType = file.type as AvatarContentType;
    const { uploadUrl, key } = await api<{ uploadUrl: string; key: string }>(
      `/rfid-cards/photos/presign`,
      { method: "POST", body: { contentType } },
    );
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!res.ok) throw new Error("Upload failed");
    return key;
  },
};
