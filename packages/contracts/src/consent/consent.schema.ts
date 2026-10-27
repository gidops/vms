import { z } from "zod";
import { PaginationQuery } from "../common/pagination.js";

export function normalizeConsentEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Status is the latest consent event; phone numbers are deliberately absent. */
export const OptInItem = z.object({
  email: z.string(),
  fullName: z.string().nullable(),
  organization: z.string().nullable(),
  consent: z.boolean(),
  answeredAt: z.coerce.date(),
  sourceVisitId: z.string().uuid().nullable(),
  sourceReferenceCode: z.string().nullable(),
  sourceVisitDate: z.coerce.date().nullable(),
});
export type OptInItem = z.infer<typeof OptInItem>;

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

export const GrantConsentInput = WithdrawConsentInput;
export type GrantConsentInput = WithdrawConsentInput;

/** `affected: false` = no consent records exist for that email; nothing written. */
export const GrantConsentResult = WithdrawConsentResult;
export type GrantConsentResult = WithdrawConsentResult;
