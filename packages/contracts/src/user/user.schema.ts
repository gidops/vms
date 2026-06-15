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
}).extend({
  /** The role currently scoping this session's permissions + dashboard. */
  activeRole: z.string().nullable().optional(),
  /** Permissions of the active role (scoped, not the union of all roles). */
  permissions: z.array(z.string()).default([]),
});
export type UserProfile = z.infer<typeof UserProfile>;

export const UpdateUserProfileInput = z.object({
  fullName: z.string().min(1).optional(),
  preferredLocale: Locale.optional(),
});
export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileInput>;

/** Admin creates a user with one or more roles. */
export const CreateUserInput = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  password: z.string().min(8),
  roles: z.array(z.string()).min(1),
});
export type CreateUserInput = z.infer<typeof CreateUserInput>;

/** Admin replaces a user's role set. */
export const UpdateUserRolesInput = z.object({
  roles: z.array(z.string()).min(1),
});
export type UpdateUserRolesInput = z.infer<typeof UpdateUserRolesInput>;

/** Row shape for the admin user-listing table. */
export const UserListItem = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(1),
  isActive: z.boolean(),
  roles: z.array(z.string()).default([]),
  createdAt: z.coerce.date(),
});
export type UserListItem = z.infer<typeof UserListItem>;
