import { z } from "zod";
import { AuthProvider, Locale } from "../common/enums.js";
import { normalizeE164 } from "../common/phone.js";

/** A user of the system (staff/host, Security Manager, gate operative, admin). */
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

/** Per-channel notification toggles shown on the Preferences tab. */
export const NotificationPrefs = z.object({
  newInviteRequest: z.boolean().default(true),
  smDenied: z.boolean().default(true),
  smApproved: z.boolean().default(true),
  flaggedVisitor: z.boolean().default(true),
});
export type NotificationPrefs = z.infer<typeof NotificationPrefs>;

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
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  /** S3 object key; the frontend builds the URL from NEXT_PUBLIC_S3_BASE_URL. */
  avatarKey: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  assignedDesk: z.string().nullable().optional(),
  notificationPrefs: NotificationPrefs.nullable().optional(),
  /** The user's Host office/department, when they host visitors (STAFF). Drives
   * the staff dashboard's "Office Floor" panel. */
  hostOffice: z.string().nullable().optional(),
  hostDepartment: z.string().nullable().optional(),
});
export type UserProfile = z.infer<typeof UserProfile>;

/** Self-service profile + preferences update (Account Settings). All optional. */
export const UpdateMeInput = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().max(32).transform(normalizeE164).nullable().optional(),
  preferredLocale: Locale.optional(),
  timezone: z.string().max(64).nullable().optional(),
  assignedDesk: z.string().max(120).nullable().optional(),
  notificationPrefs: NotificationPrefs.partial().optional(),
});
export type UpdateMeInput = z.infer<typeof UpdateMeInput>;

/** Persist a freshly-uploaded avatar's S3 object key. */
export const UpdateAvatarInput = z.object({
  avatarKey: z.string().min(1),
});
export type UpdateAvatarInput = z.infer<typeof UpdateAvatarInput>;

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
