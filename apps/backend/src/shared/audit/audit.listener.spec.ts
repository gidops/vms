import type { DomainEvent } from '../events/domain-event';
import { AuditListener } from './audit.listener';
import { AuditRepository } from './audit.repository';
import { SeqService } from './seq.service';

const event: DomainEvent = {
  id: 'e1',
  type: 'user.created',
  aggregateType: 'User',
  aggregateId: 'u1',
  payload: { email: 'a@b.c' },
  metadata: {
    actorUserId: 'admin',
    correlationId: 'c',
    ip: '1.1.1.1',
    userAgent: 'agent',
  },
  occurredAt: 'now',
};

describe('AuditListener', () => {
  let audit: { record: jest.Mock };
  let seq: { emit: jest.Mock };
  let listener: AuditListener;

  beforeEach(() => {
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    seq = { emit: jest.fn() };
    listener = new AuditListener(
      audit as unknown as AuditRepository,
      seq as unknown as SeqService,
    );
  });

  it('ignores values that are not domain events', async () => {
    await listener.handleAll({ foo: 'bar' });
    expect(audit.record).not.toHaveBeenCalled();
    expect(seq.emit).not.toHaveBeenCalled();
  });

  it('records the event (with ip/userAgent) and mirrors it to Seq', async () => {
    await listener.handleAll(event);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user.created',
        entityType: 'User',
        entityId: 'u1',
        actorUserId: 'admin',
        correlationId: 'c',
        ip: '1.1.1.1',
        userAgent: 'agent',
      }),
    );
    expect(seq.emit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.created', correlationId: 'c' }),
    );
  });

  it('does not mirror to Seq when the DB write fails', async () => {
    audit.record.mockRejectedValue(new Error('db'));
    await listener.handleAll(event);
    expect(seq.emit).not.toHaveBeenCalled();
  });
});
