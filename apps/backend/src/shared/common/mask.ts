/** Masks personal contact details for logs, audit rows and non-admin views. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\s+/g, '');
  if (digits.length <= 6) return '***';
  return `${digits.slice(0, 4)} ***${digits.slice(-3)}`;
}
