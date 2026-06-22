import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { Env } from '../../shared/config/env.schema';
import { EncryptionService } from '../../shared/crypto/encryption.service';
import type { DomainEvent } from '../../shared/events/domain-event';
import { I18nService } from '../../shared/i18n/i18n.service';
import { NotificationListener } from './notification.listener';
import { NotificationService } from './notification.service';
import { NOTIFICATION_TEMPLATES } from './notification.types';

function event(visitId: string): DomainEvent {
  return {
    id: 'e1',
    type: 'visit.approved',
    aggregateType: 'Visit',
    aggregateId: visitId,
    payload: { visitId },
    metadata: { locale: 'EN' },
    occurredAt: new Date().toISOString(),
  };
}

describe('NotificationListener', () => {
  function setup(visit: unknown) {
    const enqueue = jest.fn().mockResolvedValue(1);
    const prisma = {
      visit: { findUnique: jest.fn().mockResolvedValue(visit) },
    } as unknown as PrismaService;
    const notifications = { enqueue } as unknown as NotificationService;
    const encryption = {
      decrypt: jest.fn((v: string) => `dec:${v}`),
    } as unknown as EncryptionService;
    const config = {
      get: () => 'http://localhost:3000',
    } as unknown as ConfigService<Env, true>;
    const listener = new NotificationListener(
      prisma,
      notifications,
      encryption,
      new I18nService(),
      config,
    );
    return { listener, enqueue };
  }

  it('enqueues a localized visit-approved notification with code + channels', async () => {
    const { listener, enqueue } = setup({
      id: 'v1',
      scheduledAt: new Date('2026-06-15T00:00:00Z'),
      purpose: 'Official',
      visitor: {
        fullName: 'Paebi Bobson',
        email: 'paebi@x.com',
        phone: null,
        preferredLocale: 'FR',
      },
      host: {
        userId: 'host-user',
        user: { fullName: 'Sarah Lee', email: 'sarah@x.com', phone: null },
      },
      pass: { code: '4486-BC9C' },
    });

    await listener.onVisitApproved(event('v1'));

    expect(enqueue).toHaveBeenCalledTimes(1);
    const spec = enqueue.mock.calls[0][0];
    expect(spec.templateKey).toBe(NOTIFICATION_TEMPLATES.VISIT_APPROVED);
    expect(spec.locale).toBe('FR');
    expect(spec.data).toMatchObject({
      visitorName: 'Paebi Bobson',
      host: 'Sarah Lee',
      purpose: 'Official',
      code: '4486-BC9C',
    });
    const channels = spec.channels.map((c: { channel: string }) => c.channel);
    expect(channels).toContain('EMAIL');
    expect(channels).toContain('IN_APP');
    const email = spec.channels.find(
      (c: { channel: string }) => c.channel === 'EMAIL',
    );
    expect(email.recipient).toBe('paebi@x.com');
  });

  it('does nothing when the visit is gone', async () => {
    const { listener, enqueue } = setup(null);
    await listener.onVisitApproved(event('missing'));
    expect(enqueue).not.toHaveBeenCalled();
  });
});
