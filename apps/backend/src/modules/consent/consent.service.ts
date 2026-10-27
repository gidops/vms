import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  normalizeConsentEmail,
  type ConsentStatusFilter,
  type GrantConsentResult,
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
  consent: boolean;
  answeredAt: Date;
  sourceVisitId: string | null;
  sourceReferenceCode: string | null;
  sourceVisitDate: Date | null;
  fullName: string | null;
  organization: string | null;
}

const OPT_IN_CSV_COLUMNS = [
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

/** Consent is an append-only event log keyed on normalised email (latest answer wins); visit records are never rewritten (NDPR). */
@Injectable()
export class ConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
  ) {}

  // Names come from the visitor record, so withdrawn and admin-recorded answers (no visit) still resolve.
  private optInSql(
    search?: string,
    status: ConsentStatusFilter = 'in',
  ): Prisma.Sql {
    const statusFilter =
      status === 'all'
        ? Prisma.sql`TRUE`
        : Prisma.sql`l.consent = ${status === 'in'}`;
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
             l.consent,
             l."createdAt" AS "answeredAt",
             l."visitId" AS "sourceVisitId",
             v."referenceCode" AS "sourceReferenceCode",
             v."scheduledAt" AS "sourceVisitDate",
             vi."fullName" AS "fullName",
             vi.organization AS organization
      FROM latest l
      LEFT JOIN "Visit" v ON v.id = l."visitId"
      LEFT JOIN LATERAL (
        SELECT "fullName", organization FROM "Visitor"
        WHERE lower(email) = l.email
        ORDER BY "updatedAt" DESC
        LIMIT 1
      ) vi ON TRUE
      WHERE ${statusFilter} ${filter}`;
  }

  async list(query: OptInListQuery): Promise<Paginated<OptInItem>> {
    const base = this.optInSql(query.search, query.status);
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
        formatWat(r.answeredAt),
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

  /** No-op when the email has never answered. */
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

  /** Only for emails that have answered before; otherwise nothing is written. */
  async grant(
    rawEmail: string,
    actorUserId: string,
  ): Promise<GrantConsentResult> {
    const email = normalizeConsentEmail(rawEmail);
    const known = await this.prisma.commsConsentEvent.findFirst({
      where: { email },
      select: { id: true },
    });
    if (!known) return { affected: false };
    await this.txm.run(async (tx) => {
      const event = await tx.commsConsentEvent.create({
        data: { email, consent: true, source: 'ADMIN', actorUserId },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.ConsentGranted,
        aggregateType: 'CommsConsent',
        aggregateId: event.id,
        payload: { email },
        metadata: { actorUserId },
      });
    });
    return { affected: true };
  }
}
