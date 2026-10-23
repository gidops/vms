import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../shared/config/env.schema';
import type { RenderedMessage } from '../../notification.types';
import { MetaCloudWhatsappProvider } from './meta.provider';

function makeConfig(
  values: Partial<Record<keyof Env, unknown>>,
): ConfigService<Env, true> {
  return {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>;
}

const configured = {
  META_WHATSAPP_ACCESS_TOKEN: 'tok',
  META_WABA_PHONE_NUMBER_ID: '123',
  META_GRAPH_API_VERSION: 'v21.0',
};

const message: RenderedMessage = { to: 'whatsapp:+15551234567', text: 'hi' };

describe('MetaCloudWhatsappProvider', () => {
  const fetchMock: jest.Mock = jest.fn();
  const originalFetch = global.fetch;

  /** The RequestInit passed to fetch on call `i`, with a parsed JSON body. */
  function requestBody(i: number): Record<string, unknown> {
    const init = fetchMock.mock.calls[i][1] as { body: string };
    return JSON.parse(init.body) as Record<string, unknown>;
  }

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as typeof fetch;
  });
  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('isConfigured requires both a token and a phone-number id', () => {
    expect(
      new MetaCloudWhatsappProvider(makeConfig(configured)).isConfigured,
    ).toBe(true);
    expect(
      new MetaCloudWhatsappProvider(
        makeConfig({ META_WHATSAPP_ACCESS_TOKEN: 'tok' }),
      ).isConfigured,
    ).toBe(false);
  });

  it('POSTs a text message to the versioned Graph API endpoint with bearer auth', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const provider = new MetaCloudWhatsappProvider(makeConfig(configured));
    await provider.send(message);

    const url = fetchMock.mock.calls[0][0] as string;
    const init = fetchMock.mock.calls[0][1] as {
      method: string;
      headers: Record<string, string>;
    };
    expect(url).toBe('https://graph.facebook.com/v21.0/123/messages');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok');
    // `whatsapp:` prefix stripped for Meta.
    expect(requestBody(0)).toMatchObject({
      messaging_product: 'whatsapp',
      to: '+15551234567',
      type: 'text',
      text: { body: 'hi' },
    });
  });

  it('POSTs a template message when the message carries a template', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const provider = new MetaCloudWhatsappProvider(makeConfig(configured));
    await provider.send({
      ...message,
      template: {
        name: 'visit_approved',
        languageCode: 'fr',
        variables: ['Ada'],
      },
    });
    const body = requestBody(0);
    expect(body.type).toBe('template');
    expect(body.template).toMatchObject({
      name: 'visit_approved',
      language: { code: 'fr' },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: 'Ada' }] },
      ],
    });
  });

  it('throws on a non-2xx response so the dispatcher retries', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('bad token'),
    });
    const provider = new MetaCloudWhatsappProvider(makeConfig(configured));
    await expect(provider.send(message)).rejects.toThrow(/401/);
  });
});
