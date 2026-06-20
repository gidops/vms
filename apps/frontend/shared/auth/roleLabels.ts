/**
 * Maps a role name to a human label via the `roles` i18n namespace, falling
 * back to the raw role name when a label isn't defined.
 */
export function roleLabel(
  t: (key: string) => string,
  role: string | null | undefined,
): string {
  if (!role) return "";
  try {
    return t(role);
  } catch {
    return role;
  }
}
