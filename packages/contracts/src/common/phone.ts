// Numbers are stored as E.164; Twilio rejects anything else (error 21211).

export const PHONE_E164_RE = /^\+[1-9]\d{6,14}$/;

/** Best-effort; collapses a doubled country code (`+234 +234813…`) but never invents one. */
export function normalizeE164(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  const lastPlus = s.lastIndexOf("+");
  if (lastPlus > 0) s = s.slice(lastPlus);
  return s;
}

/** Stripping a retyped dial code is safe: no supported national number starts with its own country code. */
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

/** Matches the longest known dial code, falling back to the first. */
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
