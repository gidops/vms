import { type CreateVisitsInput, PHONE_E164_RE, toE164 } from "@vms/contracts";

export type VisitFormMode = "walkin" | "invite";

/** One guest row in the invite/walk-in form: visitor details + that guest's visit details. */
export interface GuestEntry {
  id: string;
  // Guest details
  fullName: string;
  email: string;
  organization: string;
  phoneCode: string;
  phoneNumber: string;
  // Visit details (per guest)
  hostUserId: string;
  floor: string;
  purpose: string;
  scheduledDate: string; // yyyy-mm-dd
  scheduledTime: string; // HH:mm
  notes: string;
  /**
   * "Use same visit details" — whether this guest's visit details were sourced
   * from the previous guest. Only meaningful for guests after the first. Drives
   * the copy-from-previous on check and the carry-forward on Add Guest.
   */
  useSame: boolean;
}

/** The visit-detail subset copied between guests by "Use same visit details". */
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
    useSame: true,
  };
}

/** Assemble the guest's phone as clean E.164 (e.g. "+2348076480331"), or "". */
export function formatPhone(g: Pick<GuestEntry, "phoneCode" | "phoneNumber">) {
  return toE164(g.phoneCode, g.phoneNumber);
}

/** ISO datetime from the date + time pickers, or undefined if either is missing. */
export function scheduledAtOf(g: GuestEntry): Date | undefined {
  if (!g.scheduledDate || !g.scheduledTime) return undefined;
  const d = new Date(`${g.scheduledDate}T${g.scheduledTime}`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** True if the guest's phone is blank (optional) or resolves to valid E.164. */
export function phoneValid(g: Pick<GuestEntry, "phoneCode" | "phoneNumber">): boolean {
  const e164 = formatPhone(g);
  return e164 === "" || PHONE_E164_RE.test(e164);
}

/** Per-guest detail field validity (gates the form + drives inline errors). */
export function guestDetailsValid(g: GuestEntry): boolean {
  return (
    g.fullName.trim().length > 0 &&
    EMAIL_RE.test(g.email.trim()) &&
    g.organization.trim().length > 0 &&
    phoneValid(g)
  );
}

export function visitDetailsValid(g: GuestEntry, mode: VisitFormMode): boolean {
  // Notes are optional; floor + purpose are required for every visit type.
  const base = Boolean(g.floor) && Boolean(g.purpose);
  if (mode === "walkin") return base;
  return base && Boolean(g.hostUserId) && Boolean(scheduledAtOf(g));
}

/**
 * Build the create payload. Each guest carries its own visit details (the
 * "Use same visit details" copy-forward already materialized them per guest).
 * Walk-ins omit host + schedule.
 */
export function buildCreateInput(
  guests: GuestEntry[],
  mode: VisitFormMode,
): CreateVisitsInput {
  const isInvite = mode === "invite";
  return {
    type: isInvite ? "PRE_INVITED" : "WALK_IN",
    guests: guests.map((g) => ({
      fullName: g.fullName.trim(),
      email: g.email.trim(),
      phone: formatPhone(g) || undefined,
      organization: g.organization.trim() || undefined,
      hostUserId: isInvite && g.hostUserId ? g.hostUserId : undefined,
      floor: g.floor,
      purpose: g.purpose,
      scheduledAt: isInvite ? scheduledAtOf(g) : undefined,
      notes: g.notes.trim() || undefined,
    })),
  };
}
