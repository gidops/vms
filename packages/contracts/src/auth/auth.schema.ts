import { z } from "zod";

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const RefreshInput = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof RefreshInput>;

/** Honoured only while no SUPER_ADMIN exists; 403 afterwards. */
export const SignupInput = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  password: z.string().min(8),
});
export type SignupInput = z.infer<typeof SignupInput>;

export const SwitchRoleInput = z.object({
  role: z.string().min(1),
});
export type SwitchRoleInput = z.infer<typeof SwitchRoleInput>;

/** Revokes all of the user's sessions. */
export const ChangePasswordInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;

/** Checks an emailed reset link before showing the set-password form. */
export const ValidateResetTokenInput = z.object({
  token: z.string().min(1),
});
export type ValidateResetTokenInput = z.infer<typeof ValidateResetTokenInput>;

/** Completes an admin-issued reset; the token is single-use and short-lived. */
export const CompletePasswordResetInput = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});
export type CompletePasswordResetInput = z.infer<
  typeof CompletePasswordResetInput
>;
