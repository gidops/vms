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
