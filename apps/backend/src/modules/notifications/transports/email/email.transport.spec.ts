import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema';
import type { RenderedMessage } from '../../notification.types';
import { EmailTransport } from './email.transport';
import type { EmailProvider } from './email-provider.interface';
import type { LogEmailProvider } from './log.provider';
import type { SendgridProvider } from './sendgrid.provider';
import type { SmtpProvider } from './smtp.provider';

function makeConfig(
  values: Partial<Record<keyof Env, unknown>>,
): ConfigService<Env, true> {
  return {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>;
}

function fakeProvider(name: string, isConfigured: boolean): EmailProvider {
  return { name, isConfigured, send: jest.fn().mockResolvedValue(undefined) };
}

const message: RenderedMessage = {
  to: 'visitor@example.com',
  subject: 'Approved',
  html: '<p>hi</p>',
  text: 'hi',
};

describe('EmailTransport', () => {
  function build(
    config: ConfigService<Env, true>,
    smtpConfigured: boolean,
    sendgridConfigured: boolean,
  ) {
    const smtp = fakeProvider('smtp', smtpConfigured);
    const sendgrid = fakeProvider('sendgrid', sendgridConfigured);
    const log = fakeProvider('log', true);
    const transport = new EmailTransport(
      config,
      smtp as unknown as SmtpProvider,
      sendgrid as unknown as SendgridProvider,
      log as unknown as LogEmailProvider,
    );
    return { transport, smtp, sendgrid, log };
  }

  it('isEnabled reflects EMAIL_ENABLED', () => {
    const { transport } = build(
      makeConfig({ EMAIL_ENABLED: false }),
      true,
      true,
    );
    expect(transport.isEnabled()).toBe(false);
  });

  it.each(['smtp', 'gmail', 'mailtrap'] as const)(
    'routes %s to the SmtpProvider when configured',
    async (provider) => {
      const { transport, smtp, log } = build(
        makeConfig({ EMAIL_PROVIDER: provider, EMAIL_FROM: 'no-reply@x.com' }),
        true,
        false,
      );
      await transport.send(message);
      expect(smtp.send).toHaveBeenCalledWith(message, 'no-reply@x.com');
      expect(log.send).not.toHaveBeenCalled();
    },
  );

  it('routes sendgrid to the SendgridProvider when configured', async () => {
    const { transport, sendgrid, smtp } = build(
      makeConfig({ EMAIL_PROVIDER: 'sendgrid', EMAIL_FROM: 'no-reply@x.com' }),
      false,
      true,
    );
    await transport.send(message);
    expect(sendgrid.send).toHaveBeenCalledWith(message, 'no-reply@x.com');
    expect(smtp.send).not.toHaveBeenCalled();
  });

  it('falls back to the log provider when smtp is not configured', async () => {
    const { transport, log, smtp } = build(
      makeConfig({ EMAIL_PROVIDER: 'mailtrap', EMAIL_FROM: 'no-reply@x.com' }),
      false,
      false,
    );
    await transport.send(message);
    expect(log.send).toHaveBeenCalledWith(message, 'no-reply@x.com');
    expect(smtp.send).not.toHaveBeenCalled();
  });

  it('falls back to the log provider when sendgrid is not configured', async () => {
    const { transport, log, sendgrid } = build(
      makeConfig({ EMAIL_PROVIDER: 'sendgrid', EMAIL_FROM: 'no-reply@x.com' }),
      false,
      false,
    );
    await transport.send(message);
    expect(log.send).toHaveBeenCalled();
    expect(sendgrid.send).not.toHaveBeenCalled();
  });

  describe('from address', () => {
    it('prefers EMAIL_FROM', async () => {
      const { transport, smtp } = build(
        makeConfig({
          EMAIL_PROVIDER: 'smtp',
          EMAIL_FROM: 'sender@x.com',
          SMTP_USER: 'user@x.com',
        }),
        true,
        false,
      );
      await transport.send(message);
      expect(smtp.send).toHaveBeenCalledWith(message, 'sender@x.com');
    });

    it('falls back to SMTP_USER, then a default no-reply', async () => {
      const withUser = build(
        makeConfig({ EMAIL_PROVIDER: 'smtp', SMTP_USER: 'user@x.com' }),
        true,
        false,
      );
      await withUser.transport.send(message);
      expect(withUser.smtp.send).toHaveBeenCalledWith(message, 'user@x.com');

      const noConfig = build(
        makeConfig({ EMAIL_PROVIDER: 'smtp' }),
        true,
        false,
      );
      await noConfig.transport.send(message);
      expect(noConfig.smtp.send).toHaveBeenCalledWith(
        message,
        'no-reply@aatc.org',
      );
    });
  });
});
