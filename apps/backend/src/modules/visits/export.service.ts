import { Injectable } from '@nestjs/common';
import { normalizeConsentEmail, type ExportVisitsQuery } from '@vms/contracts';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { randomUUID } from 'node:crypto';
import type { Writable } from 'node:stream';
import { PrismaService } from '../../prisma/prisma.service';
import { CSV_BOM, toCsvRow } from '../../shared/common/csv';
import { WAT_OFFSET_MS, formatWat, watDayRange } from '../../shared/common/wat';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { latestConsent } from '../consent/latest-consent';
import { evacuationAssistLabel } from './helpers/evacuation-assist';

/** Rows fetched per round-trip while streaming an export. */
const BATCH = 500;

export const EXPORT_COLUMNS = [
  'Reference code',
  'Visitor',
  'Email',
  'Phone',
  'Organization',
  'Host',
  'Visit type',
  'Channel',
  'Status',
  'Visit date',
  'Check-in time',
  'Check-out time',
  'Floor',
  'Purpose',
  'Group name',
  'Badge',
  'Evacuation assist',
  'Evacuation assistance',
  // The person's current status (latest answer wins), not the answer given
  // at this visit, so a later opt-out is never mailed from an old export.
  'Email consent',
  'Email status',
  'Created by',
] as const;

/**
 * The PDF is a printable summary, so it keeps the columns that fit a landscape
 * A4 page (indexes into EXPORT_COLUMNS; widths in points, summing to 770).
 */
const PDF_COLUMNS: { col: number; width: number }[] = [
  { col: 0, width: 62 }, // Reference code
  { col: 1, width: 100 }, // Visitor
  { col: 4, width: 100 }, // Organization
  { col: 5, width: 90 }, // Host
  { col: 6, width: 58 }, // Visit type
  { col: 8, width: 66 }, // Status
  { col: 9, width: 74 }, // Visit date
  { col: 10, width: 74 }, // Check-in time
  { col: 11, width: 74 }, // Check-out time
  { col: 12, width: 72 }, // Floor
];
const PDF_MARGIN = 36;
const PDF_ROW_HEIGHT = 16;

const TYPE_LABEL: Record<string, string> = {
  WALK_IN: 'Walk-in',
  PRE_INVITED: 'Invite',
  APPOINTMENT: 'Appointment',
};

/** Human channel for a visit's `source` (VMC station / staff / QR). */
export function channelLabel(source: string | null): string {
  switch (source) {
    case 'VMC_STATION':
    case null:
      return 'VMC';
    case 'QR_SELF_REGISTER':
      return 'QR';
    case 'STAFF':
      return 'Staff';
    default:
      return source;
  }
}

function yesNo(v: boolean | null): string {
  if (v === null) return 'Not asked';
  return v ? 'Yes' : 'No';
}

/** Email status as shown in the app: SENT means accepted by the provider. */
function emailStatusLabel(status: string | undefined): string {
  if (!status) return '';
  if (status === 'SENT') return 'Sent';
  if (status === 'FAILED') return 'Failed';
  return 'Queued';
}

/** A JS Date whose UTC fields read as WAT wall-clock (Excel has no zones). */
function asWatWallClock(d: Date | null): Date | null {
  return d ? new Date(d.getTime() + WAT_OFFSET_MS) : null;
}

type ExportVisit = Awaited<
  ReturnType<VisitExportService['fetchBatch']>
>[number];

/**
 * Visitor export (CSV / Excel / PDF) by visit date. The window is the WAT calendar
 * days `from`..`to` inclusive over `scheduledAt` (walk-ins get `now()` at
 * creation). Rows are streamed in batches. Every export is audit-logged before
 * the first byte goes out, then again (same export id) when it completes or
 * fails, so an aborted or broken download still leaves a trace.
 */
@Injectable()
export class VisitExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
  ) {}

  filename(q: ExportVisitsQuery): string {
    return `aatc-visitors_${q.from}_${q.to}.${q.format}`;
  }

  contentType(q: ExportVisitsQuery): string {
    switch (q.format) {
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'text/csv; charset=utf-8';
    }
  }

  fetchBatch(range: { gte: Date; lt: Date }, cursor?: string) {
    return this.prisma.visit.findMany({
      where: { scheduledAt: range },
      include: {
        visitor: true,
        host: { include: { user: true } },
        pass: { include: { accessCard: true } },
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  }

  /** Latest EMAIL notification status per visit (one query per batch). */
  private async emailStatuses(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.notification.findMany({
      where: { visitId: { in: ids }, channel: 'EMAIL' },
      select: { visitId: true, status: true },
      orderBy: { createdAt: 'desc' },
    });
    const out = new Map<string, string>();
    for (const r of rows) {
      if (r.visitId && !out.has(r.visitId)) out.set(r.visitId, r.status);
    }
    return out;
  }

  /**
   * One export row in EXPORT_COLUMNS order. Dates are WAT Date objects.
   * `consent` is the visitor's current email-consent status (null = never asked).
   */
  toRow(
    v: ExportVisit,
    emailStatus?: string,
    consent: boolean | null = null,
  ): (string | Date | null)[] {
    const card = v.pass?.accessCard;
    return [
      v.referenceCode ?? '',
      v.visitor.fullName,
      v.visitor.email,
      v.visitor.phone ?? '',
      v.visitor.organization ?? '',
      v.host?.user.fullName ?? '',
      TYPE_LABEL[v.type] ?? v.type,
      channelLabel(v.source),
      v.status,
      asWatWallClock(v.scheduledAt),
      asWatWallClock(v.checkInAt),
      asWatWallClock(v.checkOutAt),
      v.floor ?? '',
      v.purpose,
      v.groupName ?? '',
      card ? [card.zone, card.cardNumber].filter(Boolean).join(' · ') : '',
      yesNo(v.needsEvacuationAssist),
      evacuationAssistLabel(v.evacuationAssistTypes, v.evacuationAssistOther),
      yesNo(consent),
      emailStatusLabel(emailStatus),
      v.createdByName ?? '',
    ];
  }

  private async *batches(q: ExportVisitsQuery) {
    const range = watDayRange(q.from, q.to);
    let cursor: string | undefined;
    for (;;) {
      const batch = await this.fetchBatch(range, cursor);
      if (batch.length === 0) return;
      const [statuses, consent] = await Promise.all([
        this.emailStatuses(batch.map((v) => v.id)),
        latestConsent(
          this.prisma,
          batch.map((v) => v.visitor.email),
        ),
      ]);
      yield batch.map((v) =>
        this.toRow(
          v,
          statuses.get(v.id),
          consent.get(normalizeConsentEmail(v.visitor.email)) ?? null,
        ),
      );
      if (batch.length < BATCH) return;
      cursor = batch[batch.length - 1].id;
    }
  }

  private audit(
    type: (typeof EVENT_TYPES)[
      | 'VisitsExportStarted'
      | 'VisitsExported'
      | 'VisitsExportFailed'],
    exportId: string,
    payload: Record<string, unknown>,
    actorUserId: string,
  ) {
    return this.txm.run((tx) =>
      this.events.publish(tx, {
        type,
        aggregateType: 'Report',
        aggregateId: exportId,
        payload,
        metadata: { actorUserId },
      }),
    );
  }

  /**
   * Audit the start, stream the export to `out`, then audit the outcome.
   * Resolves to the row count. If the start can't be recorded, nothing is sent.
   */
  async write(
    q: ExportVisitsQuery,
    out: Writable,
    actorUserId: string,
  ): Promise<number> {
    const exportId = randomUUID();
    const range = { from: q.from, to: q.to, format: q.format };
    await this.audit(
      EVENT_TYPES.VisitsExportStarted,
      exportId,
      range,
      actorUserId,
    );
    let rowCount = 0;
    try {
      await this.stream(q, out, (n) => (rowCount += n));
    } catch (err) {
      await this.audit(
        EVENT_TYPES.VisitsExportFailed,
        exportId,
        { ...range, rowCount },
        actorUserId,
      ).catch(() => undefined); // keep the original error
      throw err;
    }
    await this.audit(
      EVENT_TYPES.VisitsExported,
      exportId,
      { ...range, rowCount },
      actorUserId,
    );
    return rowCount;
  }

  /** Write every row to `out`, reporting each batch's size to `add`. */
  private async stream(
    q: ExportVisitsQuery,
    out: Writable,
    add: (rows: number) => void,
  ): Promise<void> {
    if (q.format === 'pdf') {
      await this.streamPdf(q, out, add);
    } else if (q.format === 'xlsx') {
      const wb = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream: out,
        useStyles: true,
      });
      const ws = wb.addWorksheet('Visitors');
      ws.columns = EXPORT_COLUMNS.map((header, i) => ({
        header,
        width: i >= 9 && i <= 11 ? 18 : 20,
        // Visit date / check-in / check-out are typed date cells.
        ...(i >= 9 && i <= 11 ? { style: { numFmt: 'yyyy-mm-dd hh:mm' } } : {}),
      }));
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).commit();
      for await (const rows of this.batches(q)) {
        for (const r of rows) ws.addRow(r).commit();
        add(rows.length);
      }
      ws.commit();
      await wb.commit();
    } else {
      out.write(CSV_BOM + toCsvRow([...EXPORT_COLUMNS]));
      for await (const rows of this.batches(q)) {
        out.write(
          rows
            .map((r) =>
              toCsvRow(
                r.map((c) =>
                  c instanceof Date
                    ? formatWat(new Date(c.getTime() - WAT_OFFSET_MS))
                    : c,
                ),
              ),
            )
            .join(''),
        );
        add(rows.length);
      }
      out.end();
    }
  }

  /** Landscape A4 table: a title, a repeated header row, then one row per visit. */
  private async streamPdf(
    q: ExportVisitsQuery,
    out: Writable,
    add: (rows: number) => void,
  ): Promise<void> {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: PDF_MARGIN,
      info: { Title: `AATC visitors ${q.from} to ${q.to}` },
    });
    const done = new Promise<void>((resolve, reject) => {
      out.on('finish', resolve);
      out.on('error', reject);
    });
    doc.pipe(out);
    const bottom = doc.page.height - PDF_MARGIN;

    const drawRow = (cells: string[], bold: boolean) => {
      if (doc.y + PDF_ROW_HEIGHT > bottom) {
        doc.addPage();
        drawHeader();
      }
      const y = doc.y;
      let x = PDF_MARGIN;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7);
      PDF_COLUMNS.forEach(({ width }, i) => {
        doc.text(cells[i] ?? '', x + 2, y + 4, {
          width: width - 4,
          height: PDF_ROW_HEIGHT - 4,
          ellipsis: true,
          lineBreak: false,
        });
        x += width;
      });
      doc
        .moveTo(PDF_MARGIN, y + PDF_ROW_HEIGHT)
        .lineTo(x, y + PDF_ROW_HEIGHT)
        .lineWidth(0.3)
        .strokeColor('#cccccc')
        .stroke();
      doc.x = PDF_MARGIN;
      doc.y = y + PDF_ROW_HEIGHT;
    };
    const drawHeader = () =>
      drawRow(
        PDF_COLUMNS.map(({ col }) => EXPORT_COLUMNS[col]),
        true,
      );

    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(`AATC visitors — ${q.from} to ${q.to} (WAT)`);
    doc.moveDown(0.5);
    drawHeader();
    let total = 0;
    for await (const rows of this.batches(q)) {
      for (const r of rows) {
        drawRow(
          PDF_COLUMNS.map(({ col }) => {
            const c = r[col];
            return c instanceof Date
              ? formatWat(new Date(c.getTime() - WAT_OFFSET_MS))
              : (c ?? '');
          }),
          false,
        );
      }
      total += rows.length;
      add(rows.length);
    }
    if (total === 0) {
      doc
        .moveDown()
        .font('Helvetica')
        .fontSize(9)
        .text('No visits in this range.');
    }
    doc.end();
    await done;
  }
}
