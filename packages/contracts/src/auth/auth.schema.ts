import { z } from "zod";
import { UserProfile } from "../user/user.schema.js";

/**
 * Auth contracts are deliberately provider-agnostic at the API boundary: the
 * login request carries credentials for the LOCAL provider now; an OIDC/Okta
 * callback shape can be added later without changing the token/response types.
 */

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInput>;

/** Access token is short-lived; refresh is rotated server-side. */
export const AuthTokens = z.object({
  accessToken: z.string().min(1),
  /** Seconds until the access token expires. */
  expiresIn: z.number().int().positive(),
  tokenType: z.literal("Bearer").default("Bearer"),
});
export type AuthTokens = z.infer<typeof AuthTokens>;

export const LoginResponse = z.object({
  user: UserProfile,
  tokens: AuthTokens,
});
export type LoginResponse = z.infer<typeof LoginResponse>;

export const RefreshInput = z.object({
  /** Optional when the refresh token is delivered via httpOnly cookie. */
  refreshToken: z.string().min(1).optional(),
});
export type RefreshInput = z.infer<typeof RefreshInput>;

/**
 * First-run signup — bootstraps the initial SUPER_ADMIN. The backend only
 * honours this while no super admin exists; afterwards it returns 403 and all
 * users are created via the admin User Management UI.
 */
export const SignupInput = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  password: z.string().min(8),
});
export type SignupInput = z.infer<typeof SignupInput>;

/** Switch the active role profile for the current session. */
export const SwitchRoleInput = z.object({
  role: z.string().min(1),
});
export type SwitchRoleInput = z.infer<typeof SwitchRoleInput>;

/** Change the current user's password (revokes all their sessions). */
export const ChangePasswordInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;
