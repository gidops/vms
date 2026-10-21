import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  normalizeConsentEmail,
  type OptInItem,
  type OptInListQuery,
  type Paginated,
  type WithdrawConsentResult,
} from '@vms/contracts';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { toCsv } from '../../shared/common/csv';
import { formatWat } from '../../shared/common/wat';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';

interface OptInRow {
  email: string;
  consentedAt: Date;
  sourceVisitId: string | null;
  sourceReferenceCode: string | null;
  sourceVisitDate: Date | null;
  fullName: string | null;
  organization: string | null;
}

export const OPT_IN_CSV_COLUMNS = [
  'Email',
  'Full name',
  'Organization',
  'Consented at (WAT)',
  'Source visit date (WAT)',
];

/** Escape LIKE wildcards so a search for "a_b" matches literally. */
function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Communication consent. Every intake answer and every withdrawal is an
 * append-only event keyed on the normalised email; a person's current status
 * is their latest event ("latest answer wins"). Visit records are never
 * rewritten, so what was originally agreed stays on file (NDPR).
 */
@Injectable()
export class ConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
  ) {}

  /** Opted-in people, newest answer first, with an optional email/name search. */
  private optInSql(search?: string): Prisma.Sql {
    const filter = search
      ? Prisma.sql`AND (l.email ILIKE ${likePattern(search)} OR vi."fullName" ILIKE ${likePattern(search)})`
      : Prisma.empty;
    return Prisma.sql`
      WITH latest AS (
        SELECT DISTINCT ON (email) email, consent, "createdAt", "visitId"
        FROM "CommsConsentEvent"
        ORDER BY email, "createdAt" DESC, id DESC
      )
      SELECT l.email,
             l."createdAt" AS "consentedAt",
             l."visitId" AS "sourceVisitId",
             v."referenceCode" AS "sourceReferenceCode",
             v."scheduledAt" AS "sourceVisitDate",
             vi."fullName" AS "fullName",
             vi.organization AS organization
      FROM latest l
      LEFT JOIN "Visit" v ON v.id = l."visitId"
      LEFT JOIN "Visitor" vi ON vi.id = v."visitorId"
      WHERE l.consent = true ${filter}`;
  }

  async list(query: OptInListQuery): Promise<Paginated<OptInItem>> {
    const base = this.optInSql(query.search);
    const offset = (query.page - 1) * query.pageSize;
    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<OptInRow[]>`
        ${base}
        ORDER BY l."createdAt" DESC, l.email ASC
        LIMIT ${query.pageSize} OFFSET ${offset}`,
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM (${base}) AS optins`,
    ]);
    const total = Number(countRows[0]?.count ?? 0);
    return {
      items: rows.map((r) => ({ ...r })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  /** Full opted-in list as CSV (UTF-8 BOM, formula-escaped, no phones). */
  async exportCsv(actorUserId: string): Promise<string> {
    const rows = await this.prisma.$queryRaw<OptInRow[]>`
      ${this.optInSql()}
      ORDER BY l.email ASC`;
    const csv = toCsv(
      OPT_IN_CSV_COLUMNS,
      rows.map((r) => [
        r.email,
        r.fullName ?? '',
        r.organization ?? '',
        formatWat(r.consentedAt),
        formatWat(r.sourceVisitDate),
      ]),
    );
    await this.txm.run((tx) =>
      this.events.publish(tx, {
        type: EVENT_TYPES.ConsentExported,
        aggregateType: 'CommsConsent',
        aggregateId: randomUUID(),
        payload: { rowCount: rows.length },
        metadata: { actorUserId },
      }),
    );
    return csv;
  }

  /**
   * Record a withdrawal for an email. Writes nothing when the email has never
   * answered (the UI shows "No records for this email").
   */
  async withdraw(
    rawEmail: string,
    actorUserId: string,
  ): Promise<WithdrawConsentResult> {
    const email = normalizeConsentEmail(rawEmail);
    const known = await this.prisma.commsConsentEvent.findFirst({
      where: { email },
      select: { id: true },
    });
    if (!known) return { affected: false };
    await this.txm.run(async (tx) => {
      const event = await tx.commsConsentEvent.create({
        data: { email, consent: false, source: 'WITHDRAWAL', actorUserId },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.ConsentWithdrawn,
        aggregateType: 'CommsConsent',
        aggregateId: event.id,
        payload: { email },
        metadata: { actorUserId },
      });
    });
    return { affected: true };
  }
}
