import { z } from "zod";
import { PaginationQuery } from "../common/pagination.js";

/** Normalise an email the way consent events are keyed (trimmed, lower-case). */
export function normalizeConsentEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * A person who has answered the email-consent question, with their current
 * status: their most recent consent event ("latest answer wins"). Phone
 * numbers are deliberately absent.
 */
export const OptInItem = z.object({
  email: z.string(),
  fullName: z.string().nullable(),
  organization: z.string().nullable(),
  /** Current status: true = consents to Afreximbank event emails. */
  consent: z.boolean(),
  /** When the latest answer (or withdrawal / grant) was recorded. */
  answeredAt: z.coerce.date(),
  sourceVisitId: z.string().uuid().nullable(),
  /** Reference code of the source visit (null for walk-ins). */
  sourceReferenceCode: z.string().nullable(),
  sourceVisitDate: z.coerce.date().nullable(),
});
export type OptInItem = z.infer<typeof OptInItem>;

/** Which people to list by current status: consented, not consented, or both. */
export const ConsentStatusFilter = z.enum(["in", "out", "all"]);
export type ConsentStatusFilter = z.infer<typeof ConsentStatusFilter>;

export const OptInListQuery = PaginationQuery.extend({
  search: z.string().trim().min(1).max(200).optional(),
  status: ConsentStatusFilter.default("in"),
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

/** Opt a known email back in on the visitor's behalf (System Admin). */
export const GrantConsentInput = WithdrawConsentInput;
export type GrantConsentInput = WithdrawConsentInput;

/** `affected: false` = no consent records exist for that email; nothing written. */
export const GrantConsentResult = WithdrawConsentResult;
export type GrantConsentResult = WithdrawConsentResult;
