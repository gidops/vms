import {
  PHONE_E164_RE,
  evacuationAssistIssues,
  toE164,
  type EvacuationAssistType,
  type PublicHostOption,
  type PublicRegistrationInput,
} from "@vms/contracts";
import { ApiError } from "@/data/http/client";

/** The visitor's form on their phone; email is required. */
export interface SelfForm {
  email: string;
  phoneCode: string;
  phoneNumber: string;
  fullName: string;
  organization: string;
  host: PublicHostOption | null;
  floor: string;
  purpose: string;
  /** No default: `null` until answered. */
  needsEvacuationAssist: boolean | null;
  evacuationAssistTypes: EvacuationAssistType[];
  evacuationAssistOther: string;
  commsConsent: boolean | null;
  website: string;
}

export function blankSelfForm(): SelfForm {
  return {
    email: "",
    phoneCode: "+234",
    phoneNumber: "",
    fullName: "",
    organization: "",
    host: null,
    floor: "",
    purpose: "",
    needsEvacuationAssist: null,
    evacuationAssistTypes: [],
    evacuationAssistOther: "",
    commsConsent: null,
    website: "",
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SelfFormField =
  | "email"
  | "phone"
  | "fullName"
  | "organization"
  | "purpose"
  | "needsEvacuationAssist"
  | "evacuationAssistTypes"
  | "evacuationAssistOther"
  | "commsConsent";

export function selfFormErrors(
  f: SelfForm,
): Partial<Record<SelfFormField, string>> {
  const errors: Partial<Record<SelfFormField, string>> = {};
  if (!EMAIL_RE.test(f.email.trim())) errors.email = "email";
  if (f.phoneNumber.trim() && !PHONE_E164_RE.test(phoneOf(f) ?? ""))
    errors.phone = "phone";
  if (!f.fullName.trim()) errors.fullName = "required";
  if (!f.organization.trim()) errors.organization = "required";
  if (!f.purpose) errors.purpose = "choose";
  if (f.needsEvacuationAssist === null) errors.needsEvacuationAssist = "yesNo";
  if (f.commsConsent === null) errors.commsConsent = "yesNo";
  if (f.needsEvacuationAssist) {
    for (const [field] of evacuationAssistIssues({
      needsEvacuationAssist: true,
      evacuationAssistTypes: f.evacuationAssistTypes,
      evacuationAssistOther: f.evacuationAssistOther,
    })) {
      errors[field as SelfFormField] =
        field === "evacuationAssistOther" ? "describeOther" : "chooseType";
    }
  }
  return errors;
}

function phoneOf(f: SelfForm): string | undefined {
  return f.phoneNumber.trim()
    ? toE164(f.phoneCode, f.phoneNumber) || undefined
    : undefined;
}

/** The request body; only call once {@link selfFormErrors} is empty. */
export function toRegistrationInput(
  f: SelfForm,
  formToken: string,
): PublicRegistrationInput {
  const yes = f.needsEvacuationAssist === true;
  return {
    formToken,
    website: f.website || undefined,
    email: f.email.trim(),
    phone: phoneOf(f),
    fullName: f.fullName.trim(),
    organization: f.organization.trim(),
    hostUserId: f.host?.userId,
    floor: f.floor || undefined,
    purpose: f.purpose,
    needsEvacuationAssist: yes,
    ...(yes
      ? {
          evacuationAssistTypes: f.evacuationAssistTypes,
          evacuationAssistOther: f.evacuationAssistTypes.includes("OTHER")
            ? f.evacuationAssistOther.trim()
            : undefined,
        }
      : {}),
    commsConsent: f.commsConsent === true,
  };
}

export type RegistrationProblem =
  | "inactive"
  | "expired"
  | "codeWrong"
  | "tooManyTries"
  | "rateLimited"
  | "codeNotSent"
  | "invalid"
  | "offline"
  | "unknown";

/** What went wrong, from the API's status (see the public desk QR API). */
export function problemOf(err: unknown): RegistrationProblem {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 404:
        return "inactive";
      case 410:
        return "expired";
      case 422:
        return "codeWrong";
      case 423:
        return "tooManyTries";
      case 429:
        return "rateLimited";
      case 503:
        return "codeNotSent";
      case 400:
        return "invalid";
      default:
        return "unknown";
    }
  }
  // fetch() rejects with a TypeError when the phone has no connection.
  return err instanceof TypeError ? "offline" : "unknown";
}
