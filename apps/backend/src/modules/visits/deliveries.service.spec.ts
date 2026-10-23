import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../shared/auth/auth.decorators';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import {
  VisitDeliveriesService,
  maskEmail,
  maskPhone,
} from './deliveries.service';

const VISIT = '00000000-0000-4000-8000-000000000031';
const notif = (over: Record<string, unknown> = {}) => ({
  id: 'n1',
  visitId: VISIT,
  channel: 'SMS',
  templateKey: 'visit.approved',
  recipient: '+2348031184420',
  status: 'FAILED',
  attempts: 3,
  error: 'Number rejected by carrier',
  sentAt: null,
  createdAt: new Date('2026-10-18T08:13:00Z'),
  ...over,
});
const principal = (activeRole: string): AuthUser => ({
  userId: 'u1',
  email: 'u@x.com',
  roles: [activeRole],
  activeRole,
  permissions: [],
});

describe('VisitDeliveriesService', () => {
  function setup(opts: { visit?: boolean; rows?: unknown[]; one?: unknown }) {
    const update = jest.fn().mockImplementation(({ data }) => ({
      ...notif(),
      ...data,
    }));
    const prisma = {
      visit: {
        findUnique: jest
          .fn()
          .mockResolvedValue(opts.visit === false ? null : { id: VISIT }),
      },
      notification: {
        findMany: jest.fn().mockResolvedValue(opts.rows ?? []),
        findFirst: jest.fn().mockResolvedValue(opts.one ?? null),
      },
    } as unknown as PrismaService;
    const tx = { notification: { update } };
    const txm = {
      run: (fn: (t: unknown) => unknown) => fn(tx),
    } as unknown as TransactionManager;
    const publish = jest.fn().mockResolvedValue({});
    const service = new VisitDeliveriesService(prisma, txm, {
      publish,
    } as unknown as EventPublisher);
    return { service, prisma, update, publish };
  }

  it('masks recipients', () => {
    expect(maskEmail('chiamaka.nwankwo@ecobank.com')).toBe('c***@ecobank.com');
    expect(maskPhone('+2348031184420')).toBe('+234 ***420');
    expect(maskPhone('123')).toBe('***');
  });

  it('lists outbound rows only, masked, hiding errors from non-admin roles', async () => {
    const { service, prisma } = setup({ rows: [notif()] });
    const [vmcView] = await service.list(VISIT, principal('VMC'));
    expect(vmcView).toMatchObject({
      channel: 'SMS',
      recipientMasked: '+234 ***420',
      status: 'FAILED',
      attempts: 3,
      error: null,
    });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          visitId: VISIT,
          channel: { in: ['EMAIL', 'SMS', 'WHATSAPP'] },
        },
      }),
    );
    const [smView] = await service.list(VISIT, principal('ADMIN'));
    expect(smView.error).toBe('Number rejected by carrier');
    const [saView] = await service.list(VISIT, principal('SUPER_ADMIN'));
    expect(saView.error).toBe('Number rejected by carrier');
  });

  it('404s for an unknown visit', async () => {
    const { service } = setup({ visit: false });
    await expect(service.list(VISIT, principal('VMC'))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('re-queues a FAILED message and audit-logs the retry', async () => {
    const { service, update, publish } = setup({ one: notif() });
    const res = await service.retry(VISIT, 'n1', principal('VMC'));
    expect(update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: expect.objectContaining({
        status: 'PENDING',
        attempts: 0,
        error: null,
      }),
    });
    expect(res.status).toBe('PENDING');
    expect(publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: EVENT_TYPES.NotificationRetried }),
    );
  });

  it('refuses to retry a message that has not failed, or one from another visit', async () => {
    const sent = setup({ one: notif({ status: 'SENT' }) });
    await expect(
      sent.service.retry(VISIT, 'n1', principal('VMC')),
    ).rejects.toBeInstanceOf(BadRequestException);
    const missing = setup({ one: null });
    await expect(
      missing.service.retry(VISIT, 'n1', principal('VMC')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
