/**
 * Visit floors ("2nd Floor - Left Wing") and pass zones ("2nd Floor",
 * "5th Floor - left wing", "3rd Floor - LW") are named differently, so match
 * on the floor level, plus the wing when both sides name one.
 */
type Place = { level: string; wing: "L" | "R" | null };

function parsePlace(name: string): Place | null {
  const s = name.toLowerCase();
  let level: string | null = null;
  if (/\bground\b/.test(s)) level = "G";
  else if (/\bmezzanine\b/.test(s)) level = "M";
  else if (/\brooftop\b/.test(s)) level = "R";
  else level = /\b(\d+)(?:st|nd|rd|th)\b/.exec(s)?.[1] ?? null;
  if (!level) return null;

  let wing: Place["wing"] = null;
  if (/\bleft\b|\blw\b/.test(s)) wing = "L";
  else if (/\bright\b|\brw\b/.test(s)) wing = "R";
  return { level, wing };
}

/** True when a pass in `zone` can be issued for a visit to `floor`. */
export function passServesFloor(zone: string, floor: string): boolean {
  const pass = parsePlace(zone);
  const visit = parsePlace(floor);
  if (!pass || !visit || pass.level !== visit.level) return false;
  return !pass.wing || !visit.wing || pass.wing === visit.wing;
}

/**
 * Passes for the visit's floor. Falls back to every pass (with
 * `fallback: true`) when the floor is unknown or no pass serves it, so
 * reception is never blocked from checking a visitor in.
 */
export function passesForFloor<T extends { zone: string }>(
  cards: T[],
  floor: string | null | undefined,
): { cards: T[]; fallback: boolean } {
  if (!floor) return { cards, fallback: cards.length > 0 };
  const matched = cards.filter((c) => passServesFloor(c.zone, floor));
  return matched.length > 0
    ? { cards: matched, fallback: false }
    : { cards, fallback: cards.length > 0 };
}
