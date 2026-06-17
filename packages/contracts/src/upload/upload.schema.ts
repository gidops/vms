import { z } from "zod";

/** Allowed avatar image types (kept narrow for the presigned PUT). */
export const AvatarContentType = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export type AvatarContentType = z.infer<typeof AvatarContentType>;

/** Request a presigned S3 PUT URL for an avatar upload. */
export const PresignAvatarInput = z.object({
  contentType: AvatarContentType,
});
export type PresignAvatarInput = z.infer<typeof PresignAvatarInput>;

/** The presigned upload target — browser PUTs the file to `uploadUrl`, then the
 *  app persists `key` (the DB stores the key, not the full URL). */
export const PresignResult = z.object({
  uploadUrl: z.string().url(),
  key: z.string().min(1),
});
export type PresignResult = z.infer<typeof PresignResult>;

/** A session row rendered in the "Login Activity" list. */
export const LoginActivityItem = z.object({
  id: z.string().uuid(),
  os: z.string(),
  browser: z.string(),
  location: z.string().nullable().optional(),
  lastSeenAt: z.coerce.date(),
  current: z.boolean(),
});
export type LoginActivityItem = z.infer<typeof LoginActivityItem>;
