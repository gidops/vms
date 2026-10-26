import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { ConsentService } from './consent.service';

describe('ConsentService', () => {
  function setup(opts: { known?: boolean; rows?: unknown[]; count?: number }) {
    const create = jest.fn().mockResolvedValue({ id: 'evt1' });
    const queryRaw = jest.fn();
    queryRaw.mockImplementation((strings: unknown) => {
      // Second raw query in list() is the COUNT; everything else returns rows.
      const sql = JSON.stringify(strings);
      if (sql.includes('COUNT(*)'))
        return Promise.resolve([{ count: BigInt(opts.count ?? 0) }]);
      return Promise.resolve(opts.rows ?? []);
    });
    const prisma = {
      commsConsentEvent: {
        findFirst: jest
          .fn()
          .mockResolvedValue(opts.known ? { id: 'old' } : null),
      },
      $queryRaw: queryRaw,
    } as unknown as PrismaService;
    const tx = { commsConsentEvent: { create } };
    const txm = {
      run: (fn: (t: unknown) => unknown) => fn(tx),
    } as unknown as TransactionManager;
    const publish = jest.fn().mockResolvedValue({});
    const service = new ConsentService(prisma, txm, {
      publish,
    } as unknown as EventPublisher);
    return { service, prisma, create, publish };
  }

  it('writes nothing when the email has no consent records', async () => {
    const { service, create, publish } = setup({ known: false });
    await expect(service.withdraw('nobody@x.com', 'actor')).resolves.toEqual({
      affected: false,
    });
    expect(create).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('records a withdrawal event on the normalised email and audit-logs it', async () => {
    const { service, prisma, create, publish } = setup({ known: true });
    await expect(
      service.withdraw('  Emeka.Obi@AccessBankPLC.com ', 'actor'),
    ).resolves.toEqual({ affected: true });
    expect(prisma.commsConsentEvent.findFirst).toHaveBeenCalledWith({
      where: { email: 'emeka.obi@accessbankplc.com' },
      select: { id: true },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        email: 'emeka.obi@accessbankplc.com',
        consent: false,
        source: 'WITHDRAWAL',
        actorUserId: 'actor',
      },
    });
    expect(publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: EVENT_TYPES.ConsentWithdrawn,
        payload: { email: 'emeka.obi@accessbankplc.com' },
      }),
    );
  });

  it('pages the opt-in list with a total', async () => {
    const answeredAt = new Date('2026-10-18T17:42:00Z');
    const { service } = setup({
      rows: [
        {
          email: 'ngozi@dangote.com',
          consent: true,
          answeredAt,
          sourceVisitId: null,
          sourceReferenceCode: null,
          sourceVisitDate: null,
          fullName: 'Ngozi',
          organization: 'Dangote',
        },
      ],
      count: 21,
    });
    const page = await service.list({
      page: 2,
      pageSize: 8,
      sortDir: 'desc',
      status: 'in',
    });
    expect(page).toMatchObject({ page: 2, total: 21, totalPages: 3 });
    expect(page.items[0].email).toBe('ngozi@dangote.com');
  });

  it('exports a BOM-prefixed, escaped CSV without phones and audit-logs the row count', async () => {
    const { service, publish } = setup({
      rows: [
        {
          email: 'zoe@societe.fr',
          consent: true,
          answeredAt: new Date('2026-10-17T23:30:00Z'),
          sourceVisitId: 'v',
          sourceReferenceCode: 'X',
          sourceVisitDate: new Date('2026-10-17T23:00:00Z'),
          fullName: '=Zoé',
          organization: 'Société, Générale',
        },
      ],
    });
    const csv = await service.exportCsv('actor');
    expect(csv.startsWith('\uFEFFEmail,Full name,Organization')).toBe(true);
    expect(csv).toContain(
      `zoe@societe.fr,"'=Zoé","Société, Générale",2026-10-18 00:30,2026-10-18 00:00`,
    );
    expect(csv.toLowerCase()).not.toContain('phone');
    expect(publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: EVENT_TYPES.ConsentExported,
        payload: { rowCount: 1 },
      }),
    );
  });

  /** The base query list() was called with (the first raw query's nested SQL). */
  const baseSql = (prisma: PrismaService) => {
    const q = (prisma.$queryRaw as jest.Mock).mock.calls[0][1] as {
      sql: string;
      values: unknown[];
    };
    return q;
  };

  it.each([
    ['in', true],
    ['out', false],
  ] as const)(
    'filters the list by current status (%s)',
    async (status, consent) => {
      const { service, prisma } = setup({ rows: [] });
      await service.list({ page: 1, pageSize: 8, sortDir: 'desc', status });
      const q = baseSql(prisma);
      expect(q.sql).toContain('l.consent = ');
      expect(q.values).toContain(consent);
    },
  );

  it('lists everyone who answered for status "all"', async () => {
    const { service, prisma } = setup({ rows: [] });
    await service.list({
      page: 1,
      pageSize: 8,
      sortDir: 'desc',
      status: 'all',
    });
    expect(baseSql(prisma).sql).not.toContain('l.consent = ');
  });

  it('names people from their visitor record, so withdrawn rows still show a name', async () => {
    const { service, prisma } = setup({ rows: [] });
    await service.list({
      page: 1,
      pageSize: 8,
      sortDir: 'desc',
      status: 'out',
    });
    expect(baseSql(prisma).sql).toMatch(/WHERE lower\(email\) = l\.email/);
  });

  it('exports only people who currently consent', async () => {
    const { service, prisma } = setup({ rows: [] });
    await service.exportCsv('actor');
    const q = (prisma.$queryRaw as jest.Mock).mock.calls[0][1] as {
      values: unknown[];
    };
    expect(q.values).toContain(true);
  });

  it('does not grant consent to an email with no records', async () => {
    const { service, create, publish } = setup({ known: false });
    await expect(service.grant('nobody@x.com', 'admin')).resolves.toEqual({
      affected: false,
    });
    expect(create).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('records an admin grant on the normalised email and audit-logs it', async () => {
    const { service, create, publish } = setup({ known: true });
    await expect(
      service.grant(' Adaeze@Example.com ', 'admin'),
    ).resolves.toEqual({ affected: true });
    expect(create).toHaveBeenCalledWith({
      data: {
        email: 'adaeze@example.com',
        consent: true,
        source: 'ADMIN',
        actorUserId: 'admin',
      },
    });
    expect(publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: EVENT_TYPES.ConsentGranted,
        payload: { email: 'adaeze@example.com' },
        metadata: { actorUserId: 'admin' },
      }),
    );
  });
});
