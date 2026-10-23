import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema';
import type { RenderedMessage } from '../../notification.types';
import type { LogWhatsappProvider } from './log.provider';
import type { MetaCloudWhatsappProvider } from './meta.provider';
import type { TwilioWhatsappProvider } from './twilio.provider';
import type { WhatsappProvider } from './whatsapp-provider.interface';
import { WhatsappTransport } from './whatsapp.transport';

function makeConfig(
  values: Partial<Record<keyof Env, unknown>>,
): ConfigService<Env, true> {
  return {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>;
}

function fakeProvider(name: string, isConfigured: boolean): WhatsappProvider {
  return { name, isConfigured, send: jest.fn().mockResolvedValue(undefined) };
}

const message: RenderedMessage = { to: '+15551234567', text: 'hi' };

describe('WhatsappTransport', () => {
  function build(
    config: ConfigService<Env, true>,
    twilioConfigured: boolean,
    metaConfigured: boolean,
  ) {
    const twilio = fakeProvider('twilio', twilioConfigured);
    const meta = fakeProvider('meta', metaConfigured);
    const log = fakeProvider('log', true);
    const transport = new WhatsappTransport(
      config,
      twilio as unknown as TwilioWhatsappProvider,
      meta as unknown as MetaCloudWhatsappProvider,
      log as unknown as LogWhatsappProvider,
    );
    return { transport, twilio, meta, log };
  }

  it('isEnabled reflects WHATSAPP_ENABLED', () => {
    const { transport } = build(
      makeConfig({ WHATSAPP_ENABLED: false }),
      true,
      true,
    );
    expect(transport.isEnabled()).toBe(false);
  });

  it('routes to the Twilio provider by default when configured', async () => {
    const { transport, twilio, log } = build(
      makeConfig({ WHATSAPP_PROVIDER: 'twilio' }),
      true,
      false,
    );
    await transport.send(message);
    expect(twilio.send).toHaveBeenCalled();
    expect(log.send).not.toHaveBeenCalled();
  });

  it('routes to the Meta provider when WHATSAPP_PROVIDER=meta and configured', async () => {
    const { transport, meta, twilio } = build(
      makeConfig({ WHATSAPP_PROVIDER: 'meta' }),
      false,
      true,
    );
    await transport.send(message);
    expect(meta.send).toHaveBeenCalled();
    expect(twilio.send).not.toHaveBeenCalled();
  });

  it('falls back to the log provider when the chosen backend is unconfigured', async () => {
    const { transport, log, meta } = build(
      makeConfig({ WHATSAPP_PROVIDER: 'meta' }),
      false,
      false,
    );
    await transport.send(message);
    expect(log.send).toHaveBeenCalled();
    expect(meta.send).not.toHaveBeenCalled();
  });

  it('strips the template payload when WHATSAPP_USE_TEMPLATES is false', async () => {
    const { transport, twilio } = build(
      makeConfig({
        WHATSAPP_PROVIDER: 'twilio',
        WHATSAPP_USE_TEMPLATES: false,
      }),
      true,
      false,
    );
    const withTemplate: RenderedMessage = {
      ...message,
      template: { name: 'HX1', languageCode: 'en', variables: ['a'] },
    };
    await transport.send(withTemplate);
    expect(twilio.send).toHaveBeenCalledWith(
      expect.objectContaining({ template: undefined }),
    );
  });

  it('forwards the template payload when WHATSAPP_USE_TEMPLATES is true', async () => {
    const { transport, twilio } = build(
      makeConfig({ WHATSAPP_PROVIDER: 'twilio', WHATSAPP_USE_TEMPLATES: true }),
      true,
      false,
    );
    const template = { name: 'HX1', languageCode: 'en', variables: ['a'] };
    await transport.send({ ...message, template });
    expect(twilio.send).toHaveBeenCalledWith(
      expect.objectContaining({ template }),
    );
  });
});
