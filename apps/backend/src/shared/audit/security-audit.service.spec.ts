import { ClsService } from 'nestjs-cls';
import { AuditRepository } from './audit.repository';
import { SecurityAuditService } from './security-audit.service';
import { SeqService } from './seq.service';

describe('SecurityAuditService', () => {
  let audit: { record: jest.Mock };
  let seq: { emit: jest.Mock };
  let cls: { getId: jest.Mock; get: jest.Mock };
  let svc: SecurityAuditService;

  beforeEach(() => {
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    seq = { emit: jest.fn() };
    cls = {
      getId: jest.fn().mockReturnValue('corr-1'),
      get: jest.fn((k: string) => (k === 'ip' ? '1.2.3.4' : 'agent-x')),
    };
    svc = new SecurityAuditService(
      audit as unknown as AuditRepository,
      seq as unknown as SeqService,
      cls as unknown as ClsService,
    );
  });

  it('writes the audit row with CLS context and mirrors to Seq', async () => {
    await svc.record({
      action: 'auth.login_failed',
      entityType: 'User',
      level: 'Warning',
      metadata: { email: 'x@y.z' },
    });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.login_failed',
        entityType: 'User',
        correlationId: 'corr-1',
        ip: '1.2.3.4',
        userAgent: 'agent-x',
        metadata: { email: 'x@y.z' },
      }),
    );
    expect(seq.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.login_failed',
        level: 'Warning',
        correlationId: 'corr-1',
      }),
    );
  });

  it('defaults the Seq level to Warning when none is given', async () => {
    await svc.record({ action: 'auth.logout', entityType: 'Session' });
    expect(seq.emit).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'Warning' }),
    );
  });

  it('does not mirror to Seq when the DB write fails', async () => {
    audit.record.mockRejectedValue(new Error('db down'));
    await expect(
      svc.record({ action: 'auth.logout', entityType: 'Session' }),
    ).resolves.toBeUndefined();
    expect(seq.emit).not.toHaveBeenCalled();
  });
});
