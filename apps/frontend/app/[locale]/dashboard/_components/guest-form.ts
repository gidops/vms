import {
  type CreateVisitsInput,
  type EvacuationAssistType,
  PHONE_E164_RE,
  evacuationAssistIssues,
  toE164,
} from "@vms/contracts";

export type VisitFormMode = "walkin" | "invite";

export interface GuestEntry {
  id: string;
  fullName: string;
  email: string;
  organization: string;
  phoneCode: string;
  phoneNumber: string;
  hostUserId: string;
  floor: string;
  purpose: string;
  scheduledDate: string; // yyyy-mm-dd
  scheduledTime: string; // HH:mm
  notes: string;
  /** `null` = not answered yet; never copied by "Use same visit details". */
  needsEvacuationAssist: boolean | null;
  evacuationAssistTypes: EvacuationAssistType[];
  evacuationAssistOther: string;
  commsConsent: boolean | null;
  /** Visit details were copied from the previous guest (guests after the first only). */
  useSame: boolean;
}

export type VisitDetailFields = Pick<
  GuestEntry,
  | "hostUserId"
  | "floor"
  | "purpose"
  | "scheduledDate"
  | "scheduledTime"
  | "notes"
>;

export function visitDetailFields(g: GuestEntry): VisitDetailFields {
  return {
    hostUserId: g.hostUserId,
    floor: g.floor,
    purpose: g.purpose,
    scheduledDate: g.scheduledDate,
    scheduledTime: g.scheduledTime,
    notes: g.notes,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function blankGuest(): GuestEntry {
  return {
    id: crypto.randomUUID(),
    fullName: "",
    email: "",
    organization: "",
    phoneCode: "+234",
    phoneNumber: "",
    hostUserId: "",
    floor: "",
    purpose: "",
    scheduledDate: "",
    scheduledTime: "",
    notes: "",
    needsEvacuationAssist: null,
    evacuationAssistTypes: [],
    evacuationAssistOther: "",
    commsConsent: null,
    useSame: true,
  };
}

/** Clean E.164 (e.g. "+2348076480331"), or "". */
export function formatPhone(g: Pick<GuestEntry, "phoneCode" | "phoneNumber">) {
  return toE164(g.phoneCode, g.phoneNumber);
}

export function scheduledAtOf(g: GuestEntry): Date | undefined {
  if (!g.scheduledDate || !g.scheduledTime) return undefined;
  const d = new Date(`${g.scheduledDate}T${g.scheduledTime}`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** True if the guest's phone is blank (optional) or resolves to valid E.164. */
export function phoneValid(
  g: Pick<GuestEntry, "phoneCode" | "phoneNumber">,
): boolean {
  const e164 = formatPhone(g);
  return e164 === "" || PHONE_E164_RE.test(e164);
}

export function guestDetailsValid(g: GuestEntry): boolean {
  return (
    g.fullName.trim().length > 0 &&
    EMAIL_RE.test(g.email.trim()) &&
    g.organization.trim().length > 0 &&
    phoneValid(g)
  );
}

export function visitDetailsValid(g: GuestEntry, mode: VisitFormMode): boolean {
  // Floor + purpose are always required; the host only for invites.
  const base = Boolean(g.floor) && Boolean(g.purpose);
  if (mode === "walkin") return base;
  return base && Boolean(g.hostUserId) && Boolean(scheduledAtOf(g));
}

/** Both safety questions answered, and a Yes to evacuation help says what help is needed. */
export function safetyConsentValid(
  g: Pick<
    GuestEntry,
    | "needsEvacuationAssist"
    | "evacuationAssistTypes"
    | "evacuationAssistOther"
    | "commsConsent"
  >,
): boolean {
  if (g.needsEvacuationAssist === null || g.commsConsent === null) return false;
  // A "No" sends no help types (see buildCreateInput), so only a Yes is checked.
  return (
    !g.needsEvacuationAssist ||
    evacuationAssistIssues({
      needsEvacuationAssist: true,
      evacuationAssistTypes: g.evacuationAssistTypes,
      evacuationAssistOther: g.evacuationAssistOther,
    }).length === 0
  );
}

export function guestComplete(g: GuestEntry, mode: VisitFormMode): boolean {
  return (
    guestDetailsValid(g) && visitDetailsValid(g, mode) && safetyConsentValid(g)
  );
}

export interface GroupInfo {
  isGroupVisit: boolean;
  groupName: string;
  groupContact: string;
}

export function groupNameValid(group: GroupInfo): boolean {
  return !group.isGroupVisit || group.groupName.trim().length > 0;
}

/** Never turn an unanswered question into a silent "No". */
function requireAnswer(v: boolean | null): boolean {
  if (v === null) throw new Error("Unanswered safety/consent question");
  return v;
}

export function buildCreateInput(
  guests: GuestEntry[],
  mode: VisitFormMode,
  group: GroupInfo,
): CreateVisitsInput {
  const isInvite = mode === "invite";
  return {
    type: isInvite ? "PRE_INVITED" : "WALK_IN",
    isGroupVisit: group.isGroupVisit,
    groupName: group.isGroupVisit ? group.groupName.trim() : undefined,
    groupContact:
      group.isGroupVisit && group.groupContact.trim()
        ? group.groupContact.trim()
        : undefined,
    guests: guests.map((g) => ({
      fullName: g.fullName.trim(),
      email: g.email.trim(),
      phone: formatPhone(g) || undefined,
      organization: g.organization.trim() || undefined,
      hostUserId: g.hostUserId || undefined,
      floor: g.floor,
      purpose: g.purpose,
      scheduledAt: isInvite ? scheduledAtOf(g) : undefined,
      notes: g.notes.trim() || undefined,
      needsEvacuationAssist: requireAnswer(g.needsEvacuationAssist),
      ...(g.needsEvacuationAssist
        ? {
            evacuationAssistTypes: g.evacuationAssistTypes,
            evacuationAssistOther: g.evacuationAssistTypes.includes("OTHER")
              ? g.evacuationAssistOther.trim()
              : undefined,
          }
        : {}),
      commsConsent: requireAnswer(g.commsConsent),
    })),
  };
}
