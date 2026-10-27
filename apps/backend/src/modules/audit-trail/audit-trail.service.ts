import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  auditCategoryOf,
  type AuditItem,
  type AuditQuery,
  type Paginated,
} from '@vms/contracts';
import { randomUUID } from 'node:crypto';
import type { Writable } from 'node:stream';
import { PrismaService } from '../../prisma/prisma.service';
import { CSV_BOM, toCsvRow } from '../../shared/common/csv';
import { formatWat, watDayRange } from '../../shared/common/wat';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';

/** Rows fetched per round-trip while streaming an export. */
const BATCH = 500;

export const AUDIT_CSV_COLUMNS = [
  'Time (WAT)',
  'Action',
  'Category',
  'Entity type',
  'Entity id',
  'User',
  'User email',
  'IP',
  'User agent',
  'Correlation id',
  'Details',
];

const include = {
  actor: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.AuditLogInclude;

type AuditRow = Prisma.AuditLogGetPayload<{ include: typeof include }>;

type ExportFilters = Omit<
  AuditQuery,
  'page' | 'pageSize' | 'sortBy' | 'sortDir'
>;

/** Read side of the audit trail (`shared/audit` stays write-only); filtered on WAT calendar days. */
@Injectable()
export class AuditTrailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
  ) {}

  where(q: ExportFilters): Prisma.AuditLogWhereInput {
    const and: Prisma.AuditLogWhereInput[] = [
      { createdAt: watDayRange(q.from, q.to) },
    ];
    if (q.category === 'auth') {
      and.push({
        OR: [
          { action: { startsWith: 'auth.' } },
          { action: { startsWith: 'authz.' } },
        ],
      });
    } else if (q.category) {
      and.push({ action: { startsWith: `${q.category}.` } });
    }
    if (q.actorUserId) and.push({ actorUserId: q.actorUserId });
    if (q.search) {
      const contains = { contains: q.search, mode: 'insensitive' } as const;
      and.push({
        OR: [
          { action: contains },
          { entityType: contains },
          { entityId: contains },
          { correlationId: contains },
          { actor: { fullName: contains } },
          { actor: { email: contains } },
        ],
      });
    }
    return { AND: and };
  }

  toItem(row: AuditRow): AuditItem {
    return {
      id: row.id,
      createdAt: row.createdAt,
      action: row.action,
      category: auditCategoryOf(row.action),
      entityType: row.entityType,
      entityId: row.entityId,
      actor: row.actor,
      ip: row.ip,
      userAgent: row.userAgent,
      correlationId: row.correlationId,
      metadata: row.metadata ?? null,
    };
  }

  async list(q: AuditQuery): Promise<Paginated<AuditItem>> {
    const where = this.where(q);
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.toItem(r)),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize),
    };
  }

  filename(q: ExportFilters): string {
    return `aatc-audit_${q.from}_${q.to}.csv`;
  }

  /** Exports are audited at start and finish; if the start can't be recorded, nothing is sent. */
  async write(
    q: ExportFilters,
    out: Writable,
    actorUserId: string,
  ): Promise<number> {
    const exportId = randomUUID();
    const filters = {
      from: q.from,
      to: q.to,
      category: q.category ?? null,
      actorUserId: q.actorUserId ?? null,
      search: q.search ?? null,
    };
    await this.audit(
      EVENT_TYPES.AuditExportStarted,
      exportId,
      filters,
      actorUserId,
    );
    const where = this.where(q);
    let rowCount = 0;
    let cursor: string | undefined;
    out.write(CSV_BOM + toCsvRow(AUDIT_CSV_COLUMNS));
    for (;;) {
      const batch = await this.prisma.auditLog.findMany({
        where,
        include,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (batch.length === 0) break;
      out.write(batch.map((r) => toCsvRow(this.csvCells(r))).join(''));
      rowCount += batch.length;
      if (batch.length < BATCH) break;
      cursor = batch[batch.length - 1].id;
    }
    out.end();
    await this.audit(
      EVENT_TYPES.AuditExported,
      exportId,
      { ...filters, rowCount },
      actorUserId,
    );
    return rowCount;
  }

  csvCells(r: AuditRow): unknown[] {
    return [
      formatWat(r.createdAt),
      r.action,
      auditCategoryOf(r.action),
      r.entityType,
      r.entityId,
      r.actor?.fullName ?? '',
      r.actor?.email ?? '',
      r.ip,
      r.userAgent,
      r.correlationId,
      r.metadata ?? '',
    ];
  }

  private audit(
    type: (typeof EVENT_TYPES)['AuditExportStarted' | 'AuditExported'],
    exportId: string,
    payload: Record<string, unknown>,
    actorUserId: string,
  ) {
    return this.txm.run((tx) =>
      this.events.publish(tx, {
        type,
        aggregateType: 'AuditExport',
        aggregateId: exportId,
        payload,
        metadata: { actorUserId },
      }),
    );
  }
}
