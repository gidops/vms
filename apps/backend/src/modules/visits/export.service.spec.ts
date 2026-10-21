import ExcelJS from 'exceljs';
import { PassThrough } from 'node:stream';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import {
  EXPORT_COLUMNS,
  VisitExportService,
  channelLabel,
} from './export.service';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'v1',
  referenceCode: '5A19-795',
  type: 'PRE_INVITED',
  status: 'CHECKED_OUT',
  source: 'VMC_STATION',
  purpose: 'Client Meeting',
  floor: '4th Floor',
  groupName: null,
  scheduledAt: new Date('2026-10-16T23:30:00Z'),
  checkInAt: new Date('2026-10-17T08:05:00Z'),
  checkOutAt: null,
  needsEvacuationAssist: true,
  commsConsent: null,
  createdByName: 'Judith Francis',
  visitor: {
    fullName: '=cmd|calc',
    email: 'zoe@societe.fr',
    phone: '+2348031184420',
    organization: 'Société Générale',
  },
  host: { user: { fullName: 'Dr Alabi' } },
  pass: { accessCard: { cardNumber: '0019', zone: '4th Floor' } },
  ...over,
});

function collect(stream: PassThrough): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve) => {
    stream.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

describe('VisitExportService', () => {
  function setup(rows: unknown[], emails: unknown[] = []) {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce(rows)
      .mockResolvedValue([]);
    const prisma = {
      visit: { findMany },
      notification: { findMany: jest.fn().mockResolvedValue(emails) },
    } as unknown as PrismaService;
    const publish = jest.fn().mockResolvedValue({});
    const txm = {
      run: (fn: (tx: unknown) => unknown) => fn({}),
    } as unknown as TransactionManager;
    const service = new VisitExportService(prisma, txm, {
      publish,
    } as unknown as EventPublisher);
    return { service, findMany, publish };
  }

  it('filters scheduledAt on WAT day boundaries', async () => {
    const { service, findMany } = setup([]);
    const out = new PassThrough();
    const done = collect(out);
    await service.write(
      { from: '2026-10-17', to: '2026-10-17', format: 'csv' },
      out,
      'actor',
    );
    await done;
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          scheduledAt: {
            gte: new Date('2026-10-16T23:00:00Z'),
            lt: new Date('2026-10-17T23:00:00Z'),
          },
        },
      }),
    );
  });

  it('writes a header-only CSV for an empty range and audit-logs the export', async () => {
    const { service, publish } = setup([]);
    const out = new PassThrough();
    const done = collect(out);
    const n = await service.write(
      { from: '2026-10-17', to: '2026-10-18', format: 'csv' },
      out,
      'actor',
    );
    const text = (await done).toString('utf8');
    expect(n).toBe(0);
    expect(text).toBe(`\uFEFF${EXPORT_COLUMNS.join(',')}\r\n`);
    expect(publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: EVENT_TYPES.VisitsExported,
        payload: {
          from: '2026-10-17',
          to: '2026-10-18',
          format: 'csv',
          rowCount: 0,
        },
        metadata: { actorUserId: 'actor' },
      }),
    );
  });

  it('maps every column, WAT times, escaping and the latest email status', async () => {
    const { service } = setup([row()], [{ visitId: 'v1', status: 'FAILED' }]);
    const out = new PassThrough();
    const done = collect(out);
    await service.write(
      { from: '2026-10-17', to: '2026-10-17', format: 'csv' },
      out,
      'actor',
    );
    const lines = (await done).toString('utf8').split('\r\n');
    expect(lines[1]).toBe(
      [
        '5A19-795',
        `"'=cmd|calc"`,
        'zoe@societe.fr',
        `"'+2348031184420"`,
        'Société Générale',
        'Dr Alabi',
        'Invite',
        'VMC',
        'CHECKED_OUT',
        '2026-10-17 00:30',
        '2026-10-17 09:05',
        '',
        '4th Floor',
        'Client Meeting',
        '',
        '4th Floor · 0019',
        'Yes',
        'Not asked',
        'Failed',
        'Judith Francis',
      ].join(','),
    );
  });

  it('produces an xlsx with typed date cells that parses back', async () => {
    const { service } = setup([row()], [{ visitId: 'v1', status: 'SENT' }]);
    const out = new PassThrough();
    const done = collect(out);
    const n = await service.write(
      { from: '2026-10-17', to: '2026-10-17', format: 'xlsx' },
      out,
      'actor',
    );
    const buf = await done;
    expect(n).toBe(1);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('Visitors')!;
    expect(ws.getRow(1).getCell(1).value).toBe('Reference code');
    expect(ws.getRow(2).getCell(2).value).toBe('=cmd|calc');
    const visitDate = ws.getRow(2).getCell(10).value as Date;
    expect(visitDate).toBeInstanceOf(Date);
    // Stored as WAT wall-clock (Excel has no time zones).
    expect(visitDate.toISOString()).toBe('2026-10-17T00:30:00.000Z');
    expect(ws.getRow(2).getCell(19).value).toBe('Sent');
  });

  it('names the file after the range', () => {
    const { service } = setup([]);
    expect(
      service.filename({
        from: '2026-10-01',
        to: '2026-10-17',
        format: 'xlsx',
      }),
    ).toBe('aatc-visitors_2026-10-01_2026-10-17.xlsx');
    expect(channelLabel('QR_SELF_REGISTER')).toBe('QR');
    expect(channelLabel(null)).toBe('VMC');
  });
});
