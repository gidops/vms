import ExcelJS from 'exceljs';
import { PassThrough, Writable } from 'node:stream';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import {
  EXPORT_COLUMNS,
  ExportAbortedError,
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
  evacuationAssistTypes: ['MOBILITY', 'OTHER'],
  evacuationAssistOther: 'Needs a ramp',
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
  function setup(
    rows: unknown[],
    emails: unknown[] = [],
    consents: unknown[] = [],
  ) {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce(rows)
      .mockResolvedValue([]);
    const prisma = {
      visit: { findMany },
      notification: { findMany: jest.fn().mockResolvedValue(emails) },
      commsConsentEvent: { findMany: jest.fn().mockResolvedValue(consents) },
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

  it('audits the start before the first byte, then completion under the same export id', async () => {
    const { service, publish } = setup([row(), row({ id: 'v2' })]);
    const out = new PassThrough();
    let bytesAtStart = -1;
    let written = 0;
    out.on('data', (c: Buffer) => (written += c.length));
    publish.mockImplementation((_tx: unknown, e: { type: string }) => {
      if (e.type === EVENT_TYPES.VisitsExportStarted) bytesAtStart = written;
      return Promise.resolve({});
    });
    await service.write(
      { from: '2026-10-17', to: '2026-10-17', format: 'csv' },
      out,
      'actor',
    );
    expect(bytesAtStart).toBe(0);
    const [start, end] = publish.mock.calls.map(
      (c: unknown[]) =>
        c[1] as { type: string; aggregateId: string; payload: unknown },
    );
    expect(start.type).toBe(EVENT_TYPES.VisitsExportStarted);
    expect(start.payload).toEqual({
      from: '2026-10-17',
      to: '2026-10-17',
      format: 'csv',
    });
    expect(end.type).toBe(EVENT_TYPES.VisitsExported);
    expect(end.payload).toMatchObject({ rowCount: 2 });
    expect(end.aggregateId).toBe(start.aggregateId);
  });

  it('audits a failed export with the rows sent so far and rethrows', async () => {
    const { service, findMany, publish } = setup([]);
    findMany.mockReset();
    findMany
      .mockResolvedValueOnce(
        Array.from({ length: 500 }, (_, i) => row({ id: `v${i}` })),
      )
      .mockRejectedValueOnce(new Error('db gone'));
    const out = new PassThrough();
    out.resume();
    await expect(
      service.write(
        { from: '2026-10-17', to: '2026-10-17', format: 'csv' },
        out,
        'actor',
      ),
    ).rejects.toThrow('db gone');
    const types = publish.mock.calls.map(
      (c: unknown[]) => (c[1] as { type: string }).type,
    );
    expect(types).toEqual([
      EVENT_TYPES.VisitsExportStarted,
      EVENT_TYPES.VisitsExportFailed,
    ]);
    expect(publish.mock.calls[1][1]).toMatchObject({
      payload: { rowCount: 500 },
    });
  });

  it('sends nothing when the start cannot be audited', async () => {
    const { service, findMany, publish } = setup([row()]);
    publish.mockRejectedValueOnce(new Error('outbox down'));
    const out = new PassThrough();
    let written = 0;
    out.on('data', (c: Buffer) => (written += c.length));
    await expect(
      service.write(
        { from: '2026-10-17', to: '2026-10-17', format: 'csv' },
        out,
        'actor',
      ),
    ).rejects.toThrow('outbox down');
    expect(written).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
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
        'Mobility; Other: Needs a ramp',
        'Not asked',
        'Failed',
        'Judith Francis',
      ].join(','),
    );
  });

  it("fills Email consent from the visitor's current status, not the visit's answer", async () => {
    // Said yes at this visit, withdrew later: the export must read No.
    const { service } = setup(
      [row({ commsConsent: true })],
      [],
      [
        { email: 'zoe@societe.fr', consent: false },
        { email: 'zoe@societe.fr', consent: true },
      ],
    );
    const out = new PassThrough();
    const done = collect(out);
    await service.write(
      { from: '2026-10-17', to: '2026-10-17', format: 'csv' },
      out,
      'actor',
    );
    const [header, first] = (await done).toString('utf8').split('\r\n');
    const col = header.split(',').indexOf('Email consent');
    expect(col).toBeGreaterThan(-1);
    expect(first.split(',')[col]).toBe('No');
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
    expect(ws.getRow(2).getCell(20).value).toBe('Sent');
  });

  it('produces a paginated landscape PDF', async () => {
    const rows = Array.from({ length: 60 }, (_, i) => row({ id: `v${i}` }));
    const { service } = setup(rows);
    const out = new PassThrough();
    const done = collect(out);
    const q = { from: '2026-10-17', to: '2026-10-17', format: 'pdf' } as const;
    const n = await service.write(q, out, 'actor');
    const pdf = (await done).toString('latin1');
    expect(n).toBe(60);
    expect(pdf.startsWith('%PDF-')).toBe(true);
    // 60 rows don't fit one page, so the table continues onto a second.
    expect(pdf.match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1);
    expect(service.contentType(q)).toBe('application/pdf');
  });

  it('writes a PDF that says so when the range is empty', async () => {
    const { service } = setup([]);
    const out = new PassThrough();
    const done = collect(out);
    const n = await service.write(
      { from: '2026-10-17', to: '2026-10-17', format: 'pdf' },
      out,
      'actor',
    );
    expect(n).toBe(0);
    expect((await done).toString('latin1').startsWith('%PDF-')).toBe(true);
  });

  it('waits for a slow client to drain before writing more', async () => {
    const { service } = setup([row(), row({ id: 'v2' })]);
    const written: string[] = [];
    let release: () => void = () => undefined;
    // A client whose buffer is always full until it drains.
    const out = new Writable({
      highWaterMark: 1,
      write(chunk: Buffer, _enc, cb) {
        written.push(chunk.toString());
        release = cb;
      },
    });
    const done = service.write(
      { from: '2026-10-17', to: '2026-10-17', format: 'csv' },
      out,
      'actor',
    );
    await new Promise((r) => setImmediate(r));
    // Only the header has gone out: the rows wait for the drain.
    expect(written).toHaveLength(1);
    release();
    await new Promise((r) => setImmediate(r));
    release();
    await done;
    expect(written.length).toBeGreaterThan(1);
  });

  it('stops querying once the client has disconnected and audits the failure', async () => {
    const { service, findMany, publish } = setup([row()]);
    const out = new PassThrough();
    out.destroy();
    await expect(
      service.write(
        { from: '2026-10-17', to: '2026-10-17', format: 'csv' },
        out,
        'actor',
      ),
    ).rejects.toBeInstanceOf(ExportAbortedError);
    expect(findMany).not.toHaveBeenCalled();
    expect(publish).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ type: EVENT_TYPES.VisitsExportFailed }),
    );
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
