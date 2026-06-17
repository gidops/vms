const S3_BASE_URL = process.env.NEXT_PUBLIC_S3_BASE_URL ?? "";

/**
 * Builds the public avatar URL from the stored S3 object key. The DB only holds
 * the key; the domain lives in env so the bucket/CDN can change without a data
 * migration. Returns undefined when there's no key (Avatar falls back to initials).
 */
export function avatarUrl(key: string | null | undefined): string | undefined {
  if (!key) return undefined;
  if (/^https?:\/\//.test(key)) return key; // tolerate a full URL just in case
  if (!S3_BASE_URL) return undefined;
  return `${S3_BASE_URL.replace(/\/$/, "")}/${key}`;
}
