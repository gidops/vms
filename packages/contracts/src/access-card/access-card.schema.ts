import { z } from "zod";

/**
 * Zones/locations a physical access badge belongs to. Badges are a managed pool
 * (the `AccessCard` table); at check-in the VMC operator picks an available badge
 * for the relevant zone. Kept as a shared constant so the seeder, the assign-pass
 * dropdown, and any admin tooling stay in sync. The stored value is a plain string.
 */
export const ACCESS_CARD_ZONES = [
  "Ground Floor",
  "Floor Mezzanine",
  "1st Floor",
  "2nd Floor",
  "3rd Floor - LW",
  "4th Floor",
  "5th Floor - left wing",
  "5th Floor - right wing",
  "Rooftop",
] as const;

/** Filter the badge pool when populating the "Assign pass" dropdown. */
export const AccessCardQuery = z.object({
  zone: z.string().min(1).optional(),
  available: z.coerce.boolean().optional(),
});
export type AccessCardQuery = z.infer<typeof AccessCardQuery>;

/** A selectable badge in the check-in "Assign pass" dropdown. */
export const AccessCardOption = z.object({
  id: z.string().uuid(),
  cardNumber: z.string().min(1),
  zone: z.string().min(1),
  /** False when the badge is currently assigned to an on-site visit. */
  available: z.boolean(),
});
export type AccessCardOption = z.infer<typeof AccessCardOption>;
