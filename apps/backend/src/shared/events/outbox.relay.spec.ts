import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Env } from '../config/env.schema';
import { OutboxRelay } from './outbox.relay';
import { OutboxRepository } from './outbox.repository';

function makeRow(id: string) {
  return {
    id,
    eventType: 'user.created',
    aggregateType: 'User',
    aggregateId: 'u1',
    payload: {},
    metadata: {},
    createdAt: new Date(0),
  };
}

describe('OutboxRelay', () => {
  let outbox: {
    fetchPending: jest.Mock;
    markPublished: jest.Mock;
    markFailed: jest.Mock;
  };
  let emitter: { emitAsync: jest.Mock };
  let relay: OutboxRelay;

  beforeEach(() => {
    outbox = {
      fetchPending: jest.fn(),
      markPublished: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    emitter = { emitAsync: jest.fn().mockResolvedValue([]) };
    relay = new OutboxRelay(
      outbox as unknown as OutboxRepository,
      emitter as unknown as EventEmitter2,
      { get: () => 2000 } as unknown as ConfigService<Env, true>,
    );
  });

  it('publishes pending events and marks them published', async () => {
    outbox.fetchPending.mockResolvedValue([makeRow('1'), makeRow('2')]);
    await relay.drain();
    expect(emitter.emitAsync).toHaveBeenCalledTimes(2);
    expect(outbox.markPublished).toHaveBeenCalledWith('1');
    expect(outbox.markPublished).toHaveBeenCalledWith('2');
    expect(outbox.markFailed).not.toHaveBeenCalled();
  });

  it('marks an event failed (with backoff) when a handler throws', async () => {
    outbox.fetchPending.mockResolvedValue([makeRow('1')]);
    emitter.emitAsync.mockRejectedValue(new Error('handler boom'));
    await relay.drain();
    expect(outbox.markFailed).toHaveBeenCalledWith('1', expect.any(Number));
    expect(outbox.markPublished).not.toHaveBeenCalled();
  });

  it('does not run concurrent drains (draining guard)', async () => {
    let resolveFetch!: (v: unknown[]) => void;
    outbox.fetchPending.mockReturnValue(
      new Promise((r) => {
        resolveFetch = r;
      }),
    );
    const first = relay.drain();
    const second = relay.drain();
    resolveFetch([]);
    await Promise.all([first, second]);
    expect(outbox.fetchPending).toHaveBeenCalledTimes(1);
  });
});
