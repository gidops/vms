import { z } from "zod";

export const AvatarContentType = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export type AvatarContentType = z.infer<typeof AvatarContentType>;

export const PresignAvatarInput = z.object({
  contentType: AvatarContentType,
});
export type PresignAvatarInput = z.infer<typeof PresignAvatarInput>;

export const PresignImageInput = z.object({
  contentType: AvatarContentType,
});
export type PresignImageInput = z.infer<typeof PresignImageInput>;

/** The DB stores `key`, not the full URL. */
export const PresignResult = z.object({
  uploadUrl: z.string().url(),
  key: z.string().min(1),
});
export type PresignResult = z.infer<typeof PresignResult>;

export const LoginActivityItem = z.object({
  id: z.string().uuid(),
  os: z.string(),
  browser: z.string(),
  location: z.string().nullable().optional(),
  lastSeenAt: z.coerce.date(),
  current: z.boolean(),
});
export type LoginActivityItem = z.infer<typeof LoginActivityItem>;
