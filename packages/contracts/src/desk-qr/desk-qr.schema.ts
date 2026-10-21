import { z } from "zod";
import { normalizeE164 } from "../common/phone.js";
import {
  EVACUATION_ASSIST_OTHER_MAX,
  EvacuationAssistType,
  evacuationAssistIssues,
} from "../visit/visit.schema.js";

/**
 * The one QR printed at the VMC desk. Any visitor scans it, fills in a short
 * form on their phone, and — once reception reads them the 6-digit code that
 * was emailed to the desk inbox — is registered as today's walk-in (no
 * approval, host optional).
 */

/** `Visit.source` of a visit created from the desk QR. */
export const VISIT_SOURCE_DESK_QR = "QR_SELF_REGISTER";

/** Minutes a scanned form stays open, and a sent code stays valid (V1: 10). */
export const DESK_QR_FORM_MINUTES = 10;
/** Wrong codes allowed before the visitor has to start again. */
export const DESK_QR_CODE_ATTEMPTS = 3;
/** Shape of the token in the printed URL (new base64url, or an imported V1 hex). */
export const DESK_QR_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** What reception and admins see on the Desk QR page. */
export const DeskQrView = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
  /** The URL encoded in the printed QR. */
  url: z.string().url(),
  /** Verification codes are emailed here (V1: the issuer's email). */
  codeEmail: z.string().email(),
  /** Scans (form opens) in the current WAT day. */
  scansToday: z.number().int().min(0),
  lastScanAt: z.coerce.date().nullable(),
  tokenRotatedAt: z.coerce.date(),
  disabledAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  createdByName: z.string().nullable(),
});
export type DeskQrView = z.infer<typeof DeskQrView>;

export const CreateDeskQrInput = z.object({
  codeEmail: z.string().trim().email().max(100),
});
export type CreateDeskQrInput = z.infer<typeof CreateDeskQrInput>;

export const UpdateDeskQrInput = CreateDeskQrInput;
export type UpdateDeskQrInput = z.infer<typeof UpdateDeskQrInput>;

// ── Public (no login) ────────────────────────────────────────────────────────

/** Returned when a visitor opens the form from the QR. */
export const DeskQrFormSession = z.object({
  /** Signed proof the form was opened in the last DESK_QR_FORM_MINUTES. */
  formToken: z.string(),
  formExpiresAt: z.coerce.date(),
});
export type DeskQrFormSession = z.infer<typeof DeskQrFormSession>;

/** A host the visitor can pick (no email or contact details). */
export const PublicHostOption = z.object({
  userId: z.string().uuid(),
  fullName: z.string(),
  department: z.string().nullable(),
});
export type PublicHostOption = z.infer<typeof PublicHostOption>;

export const PublicHostSearchQuery = z.object({
  q: z.string().trim().min(2).max(50),
});
export type PublicHostSearchQuery = z.infer<typeof PublicHostSearchQuery>;

/** The visitor's self-registration form (V1 visit.php fields; email required). */
export const PublicRegistrationInput = z
  .object({
    formToken: z.string().min(1).max(200),
    /** Honeypot: hidden from people, so anything typed here is a bot. */
    website: z.string().max(200).optional(),
    email: z.string().trim().email().max(100),
    phone: z.string().min(3).max(30).transform(normalizeE164).optional(),
    fullName: z.string().trim().min(1).max(100),
    organization: z.string().trim().min(1).max(100),
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

/** The form was accepted; a code is on its way to the desk inbox. */
export const PublicRegistrationPending = z.object({
  registrationId: z.string().uuid(),
  codeExpiresAt: z.coerce.date(),
});
export type PublicRegistrationPending = z.infer<
  typeof PublicRegistrationPending
>;

export const VerifyRegistrationInput = z.object({
  code: z.string().regex(/^\d{6}$/),
});
export type VerifyRegistrationInput = z.infer<typeof VerifyRegistrationInput>;

/** Shown on the visitor's success screen. */
export const PublicRegistrationResult = z.object({
  referenceCode: z.string(),
  fullName: z.string(),
  hostName: z.string().nullable(),
  visitDate: z.coerce.date(),
});
export type PublicRegistrationResult = z.infer<typeof PublicRegistrationResult>;
