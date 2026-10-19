import { z } from "zod";
import { PaginationQuery } from "../common/pagination.js";

/** Normalise an email the way consent events are keyed (trimmed, lower-case). */
export function normalizeConsentEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * A person currently opted in to Afreximbank updates: their most recent consent
 * event is a "Yes" given at a visit. Phone numbers are deliberately absent.
 */
export const OptInItem = z.object({
  email: z.string(),
  fullName: z.string().nullable(),
  organization: z.string().nullable(),
  /** When the latest (Yes) answer was recorded. */
  consentedAt: z.coerce.date(),
  sourceVisitId: z.string().uuid().nullable(),
  /** Reference code of the source visit (null for walk-ins). */
  sourceReferenceCode: z.string().nullable(),
  sourceVisitDate: z.coerce.date().nullable(),
});
export type OptInItem = z.infer<typeof OptInItem>;

export const OptInListQuery = PaginationQuery.extend({
  search: z.string().trim().min(1).max(200).optional(),
});
export type OptInListQuery = z.infer<typeof OptInListQuery>;

export const WithdrawConsentInput = z.object({
  email: z.string().trim().email().max(254),
});
export type WithdrawConsentInput = z.infer<typeof WithdrawConsentInput>;

/** `affected: false` = no consent records exist for that email; nothing written. */
export const WithdrawConsentResult = z.object({
  affected: z.boolean(),
});
export type WithdrawConsentResult = z.infer<typeof WithdrawConsentResult>;
