import { z } from "zod";

/**
 * Phone helpers — the single source of truth for phone normalization shared by
 * the frontend (form capture) and backend (send-time safety net). Numbers are
 * stored and transmitted as E.164 (`+<country><national>`, no spaces), which is
 * what telephony providers require — Twilio rejects anything else with error
 * 21211 ("Invalid 'To' Phone Number").
 */

/** E.164: leading `+`, first digit 1-9, 7–15 digits total. */
export const PHONE_E164_RE = /^\+[1-9]\d{6,14}$/;

/** A phone string constrained to E.164. */
export const phoneE164 = z
  .string()
  .regex(PHONE_E164_RE, "Phone must be E.164 format, e.g. +2348012345678");

/**
 * Best-effort normalization of a possibly-dirty stored value toward E.164:
 * strips spaces/formatting, converts a `00` international prefix to `+`, and
 * collapses an accidentally doubled country code by keeping the value from the
 * last `+` (`+234 +234813…` → `+234813…`). Does not invent a country code for a
 * bare local number.
 */
export function normalizeE164(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  const lastPlus = s.lastIndexOf("+");
  if (lastPlus > 0) s = s.slice(lastPlus);
  return s;
}

/**
 * Assemble a clean E.164 number from a chosen dial code (`+234`) and the typed
 * national part. Strips non-digits; drops a leading copy of the dial code the
 * user may have retyped (`+234813…` in the number box); drops a leading national
 * trunk `0`. Returns `""` when there is no national number.
 *
 * The dial-code strip is unconditional, which is safe for the supported dial
 * codes because no national number in those plans begins with its own country
 * code (e.g. NG nationals start 7/8/9, NANP area codes are [2-9]xx).
 */
export function toE164(dialCode: string, national: string): string {
  const code = dialCode.trim();
  const codeDigits = code.replace(/\D/g, "");
  let digits = (national ?? "").replace(/\D/g, "");
  if (codeDigits && digits.startsWith(codeDigits)) {
    digits = digits.slice(codeDigits.length);
  }
  digits = digits.replace(/^0+/, "");
  if (!digits) return "";
  return `${code}${digits}`;
}

/**
 * Split a stored value back into `{ code, number }` for a two-field input,
 * tolerant of legacy dirty shapes (spaces, doubled codes). Normalizes first,
 * then matches the longest known dial code; falls back to the first dial code.
 */
export function parsePhone(
  stored: string | null | undefined,
  dialCodes: readonly string[],
): { code: string; number: string } {
  const fallback = dialCodes[0] ?? "+234";
  const norm = normalizeE164(stored);
  if (!norm) return { code: fallback, number: "" };
  const byLongest = [...dialCodes].sort((a, b) => b.length - a.length);
  for (const code of byLongest) {
    if (norm.startsWith(code)) {
      return { code, number: norm.slice(code.length) };
    }
  }
  return { code: fallback, number: norm.replace(/^\+/, "") };
}
