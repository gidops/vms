import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import type { Env } from '../../../../shared/config/env.schema';
import type { RenderedMessage } from '../../notification.types';
import { SmtpProvider } from './smtp.provider';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

const createTransportMock = createTransport as jest.Mock;

function makeConfig(
  values: Partial<Record<keyof Env, unknown>>,
): ConfigService<Env, true> {
  return {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>;
}

const message: RenderedMessage = {
  to: 'visitor@example.com',
  subject: 'Approved',
  html: '<p>hi</p>',
  text: 'hi',
};

describe('SmtpProvider', () => {
  beforeEach(() => {
    createTransportMock.mockReset();
    createTransportMock.mockReturnValue({
      sendMail: jest.fn().mockResolvedValue(undefined),
    });
  });

  describe('isConfigured', () => {
    it('is true for gmail (host is fixed) and false for smtp without SMTP_HOST', () => {
      const gmail = new SmtpProvider(makeConfig({ EMAIL_PROVIDER: 'gmail' }));
      expect(gmail.isConfigured).toBe(true);

      const smtp = new SmtpProvider(makeConfig({ EMAIL_PROVIDER: 'smtp' }));
      expect(smtp.isConfigured).toBe(false);
    });

    it('is true for smtp once SMTP_HOST is set', () => {
      const smtp = new SmtpProvider(
        makeConfig({ EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'mail.example.com' }),
      );
      expect(smtp.isConfigured).toBe(true);
    });
  });

  describe('resolveConfig (via send → createTransport)', () => {
    it('uses fixed Gmail settings with the app password', async () => {
      const provider = new SmtpProvider(
        makeConfig({
          EMAIL_PROVIDER: 'gmail',
          GMAIL_USER: 'me@gmail.com',
          GMAIL_APP_PASSWORD: 'app-pass',
        }),
      );
      await provider.send(message, 'me@gmail.com');
      expect(createTransportMock).toHaveBeenCalledWith({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: 'me@gmail.com', pass: 'app-pass' },
      });
    });

    it('uses Mailtrap host/port with auth', async () => {
      const provider = new SmtpProvider(
        makeConfig({
          EMAIL_PROVIDER: 'mailtrap',
          MAILTRAP_HOST: 'live.smtp.mailtrap.io',
          MAILTRAP_PORT: 2525,
          MAILTRAP_USER: 'api',
          MAILTRAP_PASS: 'token',
        }),
      );
      await provider.send(message, 'no-reply@x.com');
      expect(createTransportMock).toHaveBeenCalledWith({
        host: 'live.smtp.mailtrap.io',
        port: 2525,
        secure: false,
        auth: { user: 'api', pass: 'token' },
      });
    });

    it('uses generic SMTP_* settings', async () => {
      const provider = new SmtpProvider(
        makeConfig({
          EMAIL_PROVIDER: 'smtp',
          SMTP_HOST: 'mail.example.com',
          SMTP_PORT: 587,
          SMTP_SECURE: false,
          SMTP_USER: 'u',
          SMTP_PASS: 'p',
        }),
      );
      await provider.send(message, 'no-reply@x.com');
      expect(createTransportMock).toHaveBeenCalledWith({
        host: 'mail.example.com',
        port: 587,
        secure: false,
        auth: { user: 'u', pass: 'p' },
      });
    });

    it('omits auth when credentials are missing', async () => {
      const provider = new SmtpProvider(
        makeConfig({ EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'mail.example.com' }),
      );
      await provider.send(message, 'no-reply@x.com');
      expect(createTransportMock).toHaveBeenCalledWith(
        expect.objectContaining({ auth: undefined }),
      );
    });
  });

  it('sends the rendered message and reuses the transporter', async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    createTransportMock.mockReturnValue({ sendMail });
    const provider = new SmtpProvider(
      makeConfig({ EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'mail.example.com' }),
    );

    await provider.send(message, 'no-reply@x.com');
    await provider.send(message, 'no-reply@x.com');

    expect(createTransportMock).toHaveBeenCalledTimes(1); // lazily built once, reused
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'no-reply@x.com',
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    );
  });
});
