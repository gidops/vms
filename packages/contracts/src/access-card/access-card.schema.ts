import { z } from "zod";

/** Stored as a plain string, not an enum. */
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

export const AccessCardQuery = z.object({
  zone: z.string().min(1).optional(),
  available: z.coerce.boolean().optional(),
});
export type AccessCardQuery = z.infer<typeof AccessCardQuery>;

export const AccessCardOption = z.object({
  id: z.string().uuid(),
  cardNumber: z.string().min(1),
  zone: z.string().min(1),
  available: z.boolean(),
});
export type AccessCardOption = z.infer<typeof AccessCardOption>;
