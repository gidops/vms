import { ClsService } from 'nestjs-cls';
import { EventPublisher } from './event-publisher';
import { OutboxRepository } from './outbox.repository';

describe('EventPublisher', () => {
  it('stamps correlationId/ip/userAgent from CLS and appends to the outbox', async () => {
    const append = jest.fn().mockResolvedValue(undefined);
    const outbox = { append } as unknown as OutboxRepository;
    const cls = {
      getId: () => 'corr-9',
      get: (k: string) => (k === 'ip' ? '9.9.9.9' : 'agent-x'),
    } as unknown as ClsService;
    const publisher = new EventPublisher(outbox, cls);
    const tx = {} as never;

    const event = await publisher.publish(tx, {
      type: 'user.created',
      aggregateType: 'User',
      aggregateId: 'u1',
      payload: {},
      metadata: { actorUserId: 'admin' },
    });

    expect(event.metadata).toEqual(
      expect.objectContaining({
        correlationId: 'corr-9',
        ip: '9.9.9.9',
        userAgent: 'agent-x',
        actorUserId: 'admin',
      }),
    );
    expect(event.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(append).toHaveBeenCalledWith(tx, event);
  });

  it('lets explicit metadata override CLS-derived values', async () => {
    const outbox = { append: jest.fn() } as unknown as OutboxRepository;
    const cls = {
      getId: () => 'c',
      get: () => 'cls-val',
    } as unknown as ClsService;
    const publisher = new EventPublisher(outbox, cls);

    const event = await publisher.publish({} as never, {
      type: 't',
      aggregateType: 'A',
      aggregateId: '1',
      payload: {},
      metadata: { ip: 'explicit-ip' },
    });

    expect(event.metadata.ip).toBe('explicit-ip');
  });
});
