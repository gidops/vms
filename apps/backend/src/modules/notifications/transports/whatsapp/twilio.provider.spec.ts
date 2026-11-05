import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema';
import type { RenderedMessage } from '../../notification.types';
import type { TwilioClientProvider } from '../twilio.client';
import { TwilioWhatsappProvider } from './twilio.provider';

function makeConfig(
  values: Partial<Record<keyof Env, unknown>>,
): ConfigService<Env, true> {
  return {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>;
}

function makeTwilio(configured: boolean, create = jest.fn()) {
  return {
    isConfigured: configured,
    getClient: () => (configured ? { messages: { create } } : undefined),
  } as unknown as TwilioClientProvider;
}

const message: RenderedMessage = { to: '+15551234567', text: 'hello' };

describe('TwilioWhatsappProvider', () => {
  it('isConfigured requires the shared client and a WhatsApp from-number', () => {
    const configured = new TwilioWhatsappProvider(
      makeConfig({ TWILIO_WHATSAPP_FROM: '+14155238886' }),
      makeTwilio(true),
    );
    expect(configured.isConfigured).toBe(true);

    const noFrom = new TwilioWhatsappProvider(makeConfig({}), makeTwilio(true));
    expect(noFrom.isConfigured).toBe(false);
  });

  it('sends free text with whatsapp: prefixed to/from', async () => {
    const create = jest.fn().mockResolvedValue({});
    const provider = new TwilioWhatsappProvider(
      makeConfig({ TWILIO_WHATSAPP_FROM: '+14155238886' }),
      makeTwilio(true, create),
    );
    await provider.send(message);
    expect(create).toHaveBeenCalledWith({
      from: 'whatsapp:+14155238886',
      to: 'whatsapp:+15551234567',
      body: 'hello',
    });
  });

  it('sends a Content template with positional variables when present', async () => {
    const create = jest.fn().mockResolvedValue({});
    const provider = new TwilioWhatsappProvider(
      makeConfig({ TWILIO_WHATSAPP_FROM: '+14155238886' }),
      makeTwilio(true, create),
    );
    await provider.send({
      ...message,
      template: {
        name: 'HX123',
        languageCode: 'en',
        variables: ['Ada', '10am'],
      },
    });
    expect(create).toHaveBeenCalledWith({
      from: 'whatsapp:+14155238886',
      to: 'whatsapp:+15551234567',
      contentSid: 'HX123',
      contentVariables: JSON.stringify({ '1': 'Ada', '2': '10am' }),
    });
  });

  it('no-ops (logs) when Twilio is not configured', async () => {
    const create = jest.fn();
    const provider = new TwilioWhatsappProvider(
      makeConfig({}),
      makeTwilio(false, create),
    );
    await provider.send(message);
    expect(create).not.toHaveBeenCalled();
  });
});
