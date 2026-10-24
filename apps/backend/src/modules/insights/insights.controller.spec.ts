import { PERMISSIONS } from '@vms/contracts';
import type { AuthUser } from '../../shared/auth/auth.decorators';
import { InsightsController } from './insights.controller';

const principal = (...permissions: string[]): AuthUser => ({
  userId: 'u1',
  email: 'u@x.com',
  roles: [],
  permissions,
});

describe('InsightsController', () => {
  let insights: Record<string, jest.Mock>;
  let read: { list: jest.Mock };
  let ctrl: InsightsController;

  beforeEach(() => {
    insights = {
      overview: jest.fn(),
      visitors: jest.fn(),
      visitor: jest.fn(),
      analytics: jest.fn(),
    };
    read = { list: jest.fn() };
    ctrl = new InsightsController(insights as never, read as never);
  });

  it('reads facility history only with history:read', () => {
    const q = { page: 1 } as never;
    ctrl.history(q, principal(PERMISSIONS.HISTORY_READ));
    ctrl.history(q, principal(PERMISSIONS.INSIGHTS_SELF));
    expect(read.list.mock.calls).toEqual([
      [q, 'u1', true],
      [q, 'u1', false],
    ]);
  });

  it('picks the visitor scope from visitor:read', () => {
    const q = { page: 1 } as never;
    ctrl.visitors(q, principal(PERMISSIONS.VISITOR_READ));
    ctrl.visitor('p1', principal(PERMISSIONS.INSIGHTS_SELF));
    expect(insights.visitors).toHaveBeenCalledWith(q, 'facility', 'u1');
    expect(insights.visitor).toHaveBeenCalledWith('p1', 'self', 'u1');
  });

  it('adds security analytics for whoever can flag visits', () => {
    const q = { range: '7d' } as never;
    ctrl.analytics(
      q,
      principal(PERMISSIONS.REPORT_READ, PERMISSIONS.VISIT_FLAG),
    );
    ctrl.analytics(q, principal(PERMISSIONS.INSIGHTS_SELF));
    expect(insights.analytics.mock.calls).toEqual([
      [q, 'facility', 'u1', true],
      [q, 'self', 'u1', false],
    ]);
  });

  it('serves the overview', () => {
    ctrl.overview();
    expect(insights.overview).toHaveBeenCalled();
  });
});
