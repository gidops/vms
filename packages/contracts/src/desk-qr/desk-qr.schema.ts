import { z } from "zod";
import { normalizeE164 } from "../common/phone.js";
import {
  EVACUATION_ASSIST_OTHER_MAX,
  EvacuationAssistType,
  evacuationAssistIssues,
} from "../visit/visit.schema.js";

export const VISIT_SOURCE_DESK_QR = "QR_SELF_REGISTER";

/** Minutes a scanned form stays open. */
export const DESK_QR_FORM_MINUTES = 10;
/** Accepts base64url and imported legacy hex tokens. */
export const DESK_QR_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export const DeskQrView = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
  url: z.string().url(),
  scansToday: z.number().int().min(0),
  lastScanAt: z.coerce.date().nullable(),
  tokenRotatedAt: z.coerce.date(),
  disabledAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  createdByName: z.string().nullable(),
});
export type DeskQrView = z.infer<typeof DeskQrView>;

export const DeskQrFormSession = z.object({
  formToken: z.string(),
  formExpiresAt: z.coerce.date(),
  /** Counted from the response, so the countdown never depends on the phone's clock. */
  secondsLeft: z.number().int().nonnegative(),
});
export type DeskQrFormSession = z.infer<typeof DeskQrFormSession>;

/** Public: must not expose host contact details. */
export const PublicHostOption = z.object({
  userId: z.string().uuid(),
  fullName: z.string(),
  department: z.string().nullable(),
});
export type PublicHostOption = z.infer<typeof PublicHostOption>;

export const PublicHostSearchQuery = z.object({
  q: z.string().trim().min(3).max(50),
  /** The open form's token, so the directory can't be searched without loading the form. */
  formToken: z.string().min(1).max(200),
});
export type PublicHostSearchQuery = z.infer<typeof PublicHostSearchQuery>;

// Visitor-typed text shows up in staff screens and host emails, so it must not carry links or markup.
const NAME_CHARS = /^[\p{L}\p{M} .'’-]+$/u;
const ORGANIZATION_CHARS = /^[\p{L}\p{M}\p{N} .,'’&()-]+$/u;
const LOOKS_LIKE_LINK =
  /https?|www\.|[\p{L}\p{N}-]\.(?:com|net|org|info|biz|io|co|ng|xyz|app|link|click)\b/iu;

export function isPlainName(value: string): boolean {
  return NAME_CHARS.test(value) && !LOOKS_LIKE_LINK.test(value);
}

export function isPlainOrganization(value: string): boolean {
  return ORGANIZATION_CHARS.test(value) && !LOOKS_LIKE_LINK.test(value);
}

export const PublicRegistrationInput = z
  .object({
    formToken: z.string().min(1).max(200),
    /** Honeypot: hidden from people, so anything typed here is a bot. */
    website: z.string().max(200).optional(),
    email: z.string().trim().email().max(100),
    phone: z.string().min(3).max(30).transform(normalizeE164).optional(),
    fullName: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine(isPlainName, "Use letters only, without links or symbols"),
    organization: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine(
        isPlainOrganization,
        "Use letters and numbers only, without links or symbols",
      ),
    hostUserId: z.string().uuid().optional(),
    floor: z.string().trim().min(1).max(60).optional(),
    purpose: z.string().trim().min(1).max(60),
    needsEvacuationAssist: z.boolean(),
    evacuationAssistTypes: z.array(EvacuationAssistType).max(5).optional(),
    evacuationAssistOther: z
      .string()
      .trim()
      .max(EVACUATION_ASSIST_OTHER_MAX)
      .optional(),
    commsConsent: z.boolean(),
  })
  .superRefine((v, ctx) => {
    for (const [field, message] of evacuationAssistIssues(v))
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
  });
export type PublicRegistrationInput = z.infer<typeof PublicRegistrationInput>;

export const PublicRegistrationResult = z.object({
  referenceCode: z.string(),
  fullName: z.string(),
  hostName: z.string().nullable(),
  visitDate: z.coerce.date(),
});
export type PublicRegistrationResult = z.infer<typeof PublicRegistrationResult>;
