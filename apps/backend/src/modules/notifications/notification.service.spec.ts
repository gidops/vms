import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@prisma/client';
import type { Env } from '../../shared/config/env.schema';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';
import { NOTIFICATION_TEMPLATES } from './notification.types';

function makeConfig(
  toggles: Partial<Record<keyof Env, unknown>>,
): ConfigService<Env, true> {
  return {
    get: (key: keyof Env) => toggles[key],
  } as unknown as ConfigService<Env, true>;
}

describe('NotificationService', () => {
  describe('enqueue', () => {
    it('creates rows only for enabled channels with a recipient', async () => {
      const createMany = jest.fn().mockResolvedValue({ count: 2 });
      const repo = { createMany } as unknown as NotificationRepository;
      const config = makeConfig({
        EMAIL_ENABLED: true,
        SMS_ENABLED: false,
        WHATSAPP_ENABLED: false,
        INAPP_ENABLED: true,
      });
      const service = new NotificationService(repo, config);

      const count = await service.enqueue({
        templateKey: NOTIFICATION_TEMPLATES.VISIT_APPROVED,
        locale: 'EN',
        visitId: 'v1',
        data: { visitorName: 'Paebi' },
        channels: [
          { channel: NotificationChannel.EMAIL, recipient: 'p@x.com' },
          { channel: NotificationChannel.SMS, recipient: '+100' },
          { channel: NotificationChannel.WHATSAPP, recipient: '+100' },
          { channel: NotificationChannel.IN_APP, userId: 'u1' },
        ],
      });

      expect(count).toBe(2);
      const rows = createMany.mock.calls[0][0] as Array<{
        channel: NotificationChannel;
        recipient: string | null;
        userId: string | null;
      }>;
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.channel).sort()).toEqual(['EMAIL', 'IN_APP']);
      const inApp = rows.find((r) => r.channel === 'IN_APP');
      expect(inApp?.recipient).toBeNull();
      expect(inApp?.userId).toBe('u1');
    });

    it('skips enabled channels missing a recipient and does not hit the DB', async () => {
      const createMany = jest.fn();
      const repo = { createMany } as unknown as NotificationRepository;
      const config = makeConfig({
        EMAIL_ENABLED: true,
        SMS_ENABLED: true,
        WHATSAPP_ENABLED: true,
        INAPP_ENABLED: true,
      });
      const service = new NotificationService(repo, config);

      const count = await service.enqueue({
        templateKey: NOTIFICATION_TEMPLATES.VISIT_THANK_YOU,
        locale: 'EN',
        data: {},
        channels: [
          { channel: NotificationChannel.SMS, recipient: null },
          { channel: NotificationChannel.IN_APP, userId: null },
        ],
      });

      expect(count).toBe(0);
      expect(createMany).not.toHaveBeenCalled();
    });
  });
});
