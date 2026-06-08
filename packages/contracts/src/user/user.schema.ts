import { z } from "zod";
import { AuthProvider, Locale } from "../common/enums.js";

/** A user of the system (staff/host, CSO, gate operative, admin). */
export const User = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(1),
  authProvider: AuthProvider,
  tenantId: z.string().uuid().nullable().optional(),
  preferredLocale: Locale.default("EN"),
  isActive: z.boolean(),
  mfaEnabled: z.boolean().default(false),
  roles: z.array(z.string()).default([]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type User = z.infer<typeof User>;

/** Public profile shape returned to clients (no security-sensitive fields). */
export const UserProfile = User.pick({
  id: true,
  email: true,
  fullName: true,
  preferredLocale: true,
  roles: true,
});
export type UserProfile = z.infer<typeof UserProfile>;

export const UpdateUserProfileInput = z.object({
  fullName: z.string().min(1).optional(),
  preferredLocale: Locale.optional(),
});
export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileInput>;
