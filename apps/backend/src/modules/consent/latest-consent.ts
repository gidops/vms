import type { PrismaClient } from '@prisma/client';
import { normalizeConsentEmail } from '@vms/contracts';

/**
 * Current email-consent status per normalised email ("latest answer wins").
 * Emails that never answered are absent from the map. Shared by the visitor
 * directory and the visit export so both report today's status, not the
 * answer given at a past visit.
 */
export async function latestConsent(
  prisma: Pick<PrismaClient, 'commsConsentEvent'>,
  emails: string[],
): Promise<Map<string, boolean>> {
  const keys = [...new Set(emails.map(normalizeConsentEmail))];
  if (keys.length === 0) return new Map();
  const rows = await prisma.commsConsentEvent.findMany({
    where: { email: { in: keys } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { email: true, consent: true },
  });
  const out = new Map<string, boolean>();
  for (const r of rows) if (!out.has(r.email)) out.set(r.email, r.consent);
  return out;
}
