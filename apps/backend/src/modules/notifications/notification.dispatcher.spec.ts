import { ConfigService } from '@nestjs/config';
import type { Notification } from '@prisma/client';
import type { Env } from '../../shared/config/env.schema';
import { I18nService } from '../../shared/i18n/i18n.service';
import { NotificationDispatcher } from './notification.dispatcher';
import { NotificationRepository } from './notification.repository';
import type { TemplateService } from './templates/template.service';
import type { ChannelRegistry } from './transports/channel.registry';

function row(over: Partial<Notification>): Notification {
  return {
    id: 'n1',
    userId: null,
    visitorEmail: null,
    recipient: null,
    channel: 'EMAIL',
    locale: 'EN',
    templateKey: 'visit.approved',
    payload: {},
    status: 'PENDING',
    attempts: 0,
    availableAt: new Date(),
    error: null,
    readAt: null,
    visitId: null,
    sentAt: null,
    createdAt: new Date(),
    ...over,
  };
}

function makeConfig(): ConfigService<Env, true> {
  return {
    get: (k: keyof Env) => (k === 'NOTIFICATION_MAX_ATTEMPTS' ? 5 : undefined),
  } as unknown as ConfigService<Env, true>;
}

const i18n = new I18nService();

describe('NotificationDispatcher', () => {
  it('delivers an IN_APP notification by persisting the rendered title/body', async () => {
    const markSent = jest.fn().mockResolvedValue(undefined);
    const repo = {
      fetchPending: jest.fn().mockResolvedValue([
        row({
          channel: 'IN_APP',
          userId: 'u1',
          payload: { visitorName: 'P' },
        }),
      ]),
      markSent,
      markFailed: jest.fn(),
    } as unknown as NotificationRepository;
    const templates = {
      render: jest.fn().mockResolvedValue({ subject: 'Title', text: 'Body' }),
    } as unknown as TemplateService;
    const registry = { get: jest.fn() } as unknown as ChannelRegistry;

    const d = new NotificationDispatcher(
      repo,
      templates,
      registry,
      i18n,
      makeConfig(),
    );
    await d.drain();

    expect(markSent).toHaveBeenCalledWith(
      'n1',
      expect.objectContaining({ title: 'Title', body: 'Body' }),
    );
  });

  it('sends via the channel transport and marks sent', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const markSent = jest.fn().mockResolvedValue(undefined);
    const repo = {
      fetchPending: jest
        .fn()
        .mockResolvedValue([row({ channel: 'EMAIL', recipient: 'p@x.com' })]),
      markSent,
      markFailed: jest.fn(),
    } as unknown as NotificationRepository;
    const templates = {
      render: jest.fn().mockResolvedValue({ subject: 'S', html: '<p>hi</p>' }),
    } as unknown as TemplateService;
    const registry = {
      get: () => ({ channel: 'EMAIL', isEnabled: () => true, send }),
    } as unknown as ChannelRegistry;

    const d = new NotificationDispatcher(
      repo,
      templates,
      registry,
      i18n,
      makeConfig(),
    );
    await d.drain();

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'p@x.com', html: '<p>hi</p>' }),
    );
    expect(markSent).toHaveBeenCalledWith('n1');
  });

  it('marks FAILED (exhausted) once max attempts are reached', async () => {
    const markFailed = jest.fn().mockResolvedValue(undefined);
    const repo = {
      fetchPending: jest
        .fn()
        .mockResolvedValue([
          row({ channel: 'EMAIL', recipient: 'p@x.com', attempts: 4 }),
        ]),
      markSent: jest.fn(),
      markFailed,
    } as unknown as NotificationRepository;
    const templates = {
      render: jest.fn().mockResolvedValue({ subject: 'S', html: 'x' }),
    } as unknown as TemplateService;
    const registry = {
      get: () => ({
        channel: 'EMAIL',
        isEnabled: () => true,
        send: jest.fn().mockRejectedValue(new Error('smtp down')),
      }),
    } as unknown as ChannelRegistry;

    const d = new NotificationDispatcher(
      repo,
      templates,
      registry,
      i18n,
      makeConfig(),
    );
    await d.drain();

    expect(markFailed).toHaveBeenCalledWith(
      'n1',
      expect.any(Number),
      'smtp down',
      true,
    );
  });
});
