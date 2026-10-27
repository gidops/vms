import { z } from "zod";
import { AuthProvider, Locale } from "../common/enums.js";
import { normalizeE164 } from "../common/phone.js";

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

export const NotificationPrefs = z.object({
  newInviteRequest: z.boolean().default(true),
  smDenied: z.boolean().default(true),
  smApproved: z.boolean().default(true),
  flaggedVisitor: z.boolean().default(true),
});
export type NotificationPrefs = z.infer<typeof NotificationPrefs>;

export const UserProfile = User.pick({
  id: true,
  email: true,
  fullName: true,
  preferredLocale: true,
  roles: true,
}).extend({
  activeRole: z.string().nullable().optional(),
  /** Active role only, not the union of all roles. */
  permissions: z.array(z.string()).default([]),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  /** S3 key, not a URL. */
  avatarKey: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  assignedDesk: z.string().nullable().optional(),
  notificationPrefs: NotificationPrefs.nullable().optional(),
  hostOffice: z.string().nullable().optional(),
  hostDepartment: z.string().nullable().optional(),
});
export type UserProfile = z.infer<typeof UserProfile>;

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

export const UpdateAvatarInput = z.object({
  avatarKey: z.string().min(1),
});
export type UpdateAvatarInput = z.infer<typeof UpdateAvatarInput>;

export const CreateUserInput = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  password: z.string().min(8),
  roles: z.array(z.string()).min(1),
});
export type CreateUserInput = z.infer<typeof CreateUserInput>;

export const UpdateUserRolesInput = z.object({
  roles: z.array(z.string()).min(1),
});
export type UpdateUserRolesInput = z.infer<typeof UpdateUserRolesInput>;

export const UserListItem = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(1),
  isActive: z.boolean(),
  roles: z.array(z.string()).default([]),
  createdAt: z.coerce.date(),
});
export type UserListItem = z.infer<typeof UserListItem>;
