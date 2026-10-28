import {
  PHONE_E164_RE,
  evacuationAssistIssues,
  isPlainName,
  isPlainOrganization,
  toE164,
  type EvacuationAssistType,
  type PublicHostOption,
  type DeskQrFormSession,
  type PublicRegistrationInput,
  type PublicRegistrationResult,
} from "@vms/contracts";
import type { Timed } from "@/data/desk-qr/public-registration.queries";
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
  else if (!isPlainName(f.fullName.trim())) errors.fullName = "plainName";
  if (!f.organization.trim()) errors.organization = "required";
  else if (!isPlainOrganization(f.organization.trim()))
    errors.organization = "plainOrganization";
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
  | "rejected"
  | "rateLimited"
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
      // A forged/stale form token or a host who is no longer staff.
      case 422:
        return "rejected";
      case 429:
        return "rateLimited";
      case 400:
        return "invalid";
      default:
        return "unknown";
    }
  }
  // fetch() rejects with a TypeError when the phone has no connection.
  return err instanceof TypeError ? "offline" : "unknown";
}

export function problemText(
  t: (key: "problems.offline" | "problems.unknown") => string,
  problem: RegistrationProblem,
  err: unknown,
): string {
  if (problem === "offline") return t("problems.offline");
  // Everything else comes back from the server already in the visitor's language.
  return err instanceof Error && err.message
    ? err.message
    : t("problems.unknown");
}

export type Step =
  | { kind: "form" }
  | { kind: "inactive" }
  | { kind: "done"; result: PublicRegistrationResult }
  /** `timedOut`: the countdown ran out on this screen, so focus moves to the notice. */
  | { kind: "expired"; timedOut?: boolean };

/** What the screen shows: the step, unless opening or the form could not open. */
export type Phase =
  | Exclude<Step, { kind: "form" }>
  | { kind: "opening" }
  | { kind: "form"; session: Timed<DeskQrFormSession> };

export function phaseOf(
  session: {
    loading: boolean;
    problem: RegistrationProblem | null;
    data: Timed<DeskQrFormSession> | undefined;
  },
  step: Step,
): Phase {
  if (session.loading) return { kind: "opening" };
  if (session.problem === "inactive") return { kind: "inactive" };
  if (session.problem) return { kind: "expired" };
  if (step.kind !== "form") return step;
  return session.data
    ? { kind: "form", session: session.data }
    : { kind: "opening" };
}

/** On the `performance.now()` clock: server-counted seconds from when the response arrived. */
export const deadlineOf = (r: { receivedAt: number; secondsLeft: number }) =>
  r.receivedAt + r.secondsLeft * 1000;

export const secondsUntil = (deadline: number, now = performance.now()) =>
  Math.max(0, Math.ceil((deadline - now) / 1000));

export const formatCountdown = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
