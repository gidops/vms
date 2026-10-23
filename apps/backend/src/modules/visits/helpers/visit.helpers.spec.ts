import type { VisitListQuery } from '@vms/contracts';
import { generateAccessCode, generateReferenceCode } from './visit.codes';
import { buildOrderBy, deriveGroupStatus, isTerminal } from './visit.grouping';

const query = (over: Partial<VisitListQuery>): VisitListQuery => ({
  page: 1,
  pageSize: 20,
  sortDir: 'desc',
  scope: 'all',
  dateField: 'scheduledAt',
  ...over,
});

describe('buildOrderBy', () => {
  it('defaults to scheduled date, undated visits last', () => {
    expect(buildOrderBy(query({}))).toEqual({
      scheduledAt: { sort: 'asc', nulls: 'last' },
    });
  });

  it('orders by createdAt in the requested direction when sortBy=createdAt', () => {
    expect(
      buildOrderBy(query({ sortBy: 'createdAt', sortDir: 'desc' })),
    ).toEqual({ createdAt: 'desc' });
    expect(
      buildOrderBy(query({ sortBy: 'createdAt', sortDir: 'asc' })),
    ).toEqual({
      createdAt: 'asc',
    });
  });
});

describe('deriveGroupStatus', () => {
  it('falls back to the representative status when no member statuses are known', () => {
    expect(deriveGroupStatus(undefined, 'APPROVED')).toBe('APPROVED');
    expect(deriveGroupStatus(new Set(), 'CHECKED_IN')).toBe('CHECKED_IN');
  });

  it('falls back when every member left the group (all inactive)', () => {
    expect(
      deriveGroupStatus(new Set(['DENIED', 'CANCELLED']), 'APPROVED'),
    ).toBe('APPROVED');
  });

  it('stays Expected while any active member has not checked in', () => {
    expect(
      deriveGroupStatus(new Set(['APPROVED', 'CHECKED_IN']), 'PENDING'),
    ).toBe('APPROVED');
    expect(
      deriveGroupStatus(new Set(['PENDING', 'CHECKED_IN']), 'PENDING'),
    ).toBe('APPROVED');
  });

  it('is Onsite when all checked in (ignoring some who left)', () => {
    expect(deriveGroupStatus(new Set(['CHECKED_IN']), 'PENDING')).toBe(
      'CHECKED_IN',
    );
    expect(
      deriveGroupStatus(new Set(['CHECKED_IN', 'CHECKED_OUT']), 'PENDING'),
    ).toBe('CHECKED_IN');
  });

  it('is Checked Out only once every active member has left', () => {
    expect(deriveGroupStatus(new Set(['CHECKED_OUT']), 'PENDING')).toBe(
      'CHECKED_OUT',
    );
  });

  it('ignores inactive members when deriving the status', () => {
    expect(
      deriveGroupStatus(new Set(['CANCELLED', 'CHECKED_IN']), 'PENDING'),
    ).toBe('CHECKED_IN');
  });
});

describe('isTerminal', () => {
  it.each(['DENIED', 'CANCELLED', 'EXPIRED', 'CHECKED_OUT'])(
    'treats %s as terminal',
    (status) => {
      expect(isTerminal(status)).toBe(true);
    },
  );

  it.each(['PENDING', 'REVIEW_REQUESTED', 'APPROVED', 'FLAGGED', 'CHECKED_IN'])(
    'treats %s as non-terminal',
    (status) => {
      expect(isTerminal(status)).toBe(false);
    },
  );
});

describe('code generators', () => {
  it('mints an access code as digits-dash-alnum', () => {
    expect(generateAccessCode()).toMatch(/^\d{4}-[A-Z0-9]{4}$/);
  });

  it('mints a reference code as alnum-dash-digits', () => {
    expect(generateReferenceCode()).toMatch(/^[A-Z0-9]{4}-\d{3}$/);
  });
});
