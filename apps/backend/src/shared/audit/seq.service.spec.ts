import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { SeqService } from './seq.service';

function makeConfig(values: Record<string, unknown>): ConfigService<Env, true> {
  return {
    get: (k: string) => values[k],
  } as unknown as ConfigService<Env, true>;
}

describe('SeqService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('is disabled and emits nothing when SEQ_URL is unset', () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const svc = new SeqService(makeConfig({}));

    expect(svc.enabled).toBe(false);
    svc.emit({ action: 'a', entityType: 'User' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs a CLEF event to the raw ingestion endpoint when enabled', () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    const svc = new SeqService(
      makeConfig({ SEQ_URL: 'http://seq:5341', SEQ_API_KEY: 'k' }),
    );

    expect(svc.enabled).toBe(true);
    svc.emit({
      action: 'auth.login_failed',
      entityType: 'User',
      correlationId: 'c1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://seq:5341/api/events/raw?clef');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['X-Seq-ApiKey']).toBe('k');
    const body = JSON.parse(init.body as string);
    expect(body.audit).toBe(true);
    expect(body.action).toBe('auth.login_failed');
    expect(body.correlationId).toBe('c1');
    expect(body['@t']).toBeDefined();
  });

  it('strips a trailing slash from SEQ_URL', () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    const svc = new SeqService(
      makeConfig({ SEQ_URL: 'http://localhost:5341/' }),
    );
    svc.emit({ action: 'a', entityType: 'User' });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:5341/api/events/raw?clef',
    );
  });

  it('swallows fetch failures (fire-and-forget, never throws)', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('seq down'));
    global.fetch = fetchMock;
    const svc = new SeqService(makeConfig({ SEQ_URL: 'http://seq:5341' }));

    expect(() => svc.emit({ action: 'a', entityType: 'User' })).not.toThrow();
    await Promise.resolve();
  });
});
