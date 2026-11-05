const S3_BASE_URL = process.env.NEXT_PUBLIC_S3_BASE_URL ?? "";

/** The DB stores only the S3 key; the base URL lives in env so the bucket/CDN can change without a migration. */
export function avatarUrl(key: string | null | undefined): string | undefined {
  if (!key) return undefined;
  if (/^https?:\/\//.test(key)) return key; // tolerate a full URL just in case
  if (!S3_BASE_URL) return undefined;
  return `${S3_BASE_URL.replace(/\/$/, "")}/${key}`;
}
