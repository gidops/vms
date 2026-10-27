import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ensureAllExist, ensureExists } from './visit.guards';
import {
  toDetail,
  toListItem,
  type VisitDetailRow,
  type VisitListRow,
} from './visit.mappers';

const at = new Date('2026-10-27T09:00:00Z');

const hostRow = {
  id: 'h1',
  userId: 'u-host',
  department: 'Finance',
  office: '3F',
  createdAt: at,
  updatedAt: at,
  user: {
    id: 'u-host',
    fullName: 'Sarah Lee',
    email: 'sarah@x.com',
    passwordHash: 'secret-hash',
  },
};

const visitRow = {
  id: 'v1',
  visitorId: 'vis1',
  hostId: 'h1',
  invitationId: null,
  groupId: null,
  isGroupVisit: false,
  groupName: null,
  groupContact: null,
  referenceCode: '5A19-795',
  type: 'PRE_INVITED',
  status: 'APPROVED',
  purpose: 'Meeting',
  floor: '3',
  riskLevel: 'LOW',
  scheduledAt: at,
  gateValidatedAt: null,
  checkInAt: null,
  checkOutAt: null,
  needsEvacuationAssist: false,
  evacuationAssistTypes: [],
  evacuationAssistOther: null,
  commsConsent: true,
  createdAt: at,
  updatedAt: at,
  source: 'VMC_STATION',
  createdById: 'u-creator',
  createdByName: null,
  visitor: { id: 'vis1', fullName: 'Paebi Bobson' },
  host: hostRow,
};

describe('toDetail', () => {
  const detail = (over: Record<string, unknown> = {}) =>
    toDetail({
      ...visitRow,
      createdBy: { fullName: 'Ada Creator' },
      notes: [],
      alerts: [],
      pass: null,
      ...over,
    } as unknown as VisitDetailRow);

  it('exposes only public host user fields', () => {
    expect(detail().host?.user).toEqual({
      id: 'u-host',
      fullName: 'Sarah Lee',
      email: 'sarah@x.com',
    });
  });

  it('falls back to the creator relation for the creator name', () => {
    expect(detail().createdByName).toBe('Ada Creator');
    expect(detail({ createdByName: 'Stored Name' }).createdByName).toBe(
      'Stored Name',
    );
    expect(detail({ createdBy: null }).createdByName).toBeNull();
  });

  it('maps the pass only when a card is attached', () => {
    expect(detail().pass).toBeNull();
    expect(detail({ pass: { status: 'ACTIVE', accessCard: null } }).pass).toBe(
      null,
    );
    expect(
      detail({
        pass: {
          status: 'ACTIVE',
          accessCard: { cardNumber: 'C-12', zone: 'A', assignedAt: at },
        },
      }).pass,
    ).toEqual({
      cardNumber: 'C-12',
      zone: 'A',
      status: 'ACTIVE',
      assignedAt: at,
    });
  });

  it('returns no host for walk-ins without one', () => {
    expect(detail({ host: null }).host).toBeNull();
  });

  it('maps notes and alerts, tolerating a missing alerts relation', () => {
    const d = detail({
      notes: [
        {
          id: 'n1',
          visitId: 'v1',
          alertId: null,
          authorId: 'u1',
          authorName: 'VMC',
          body: 'Arrived early',
          createdAt: at,
          author: { passwordHash: 'x' },
        },
      ],
      alerts: undefined,
    });
    expect(d.notes).toEqual([
      expect.objectContaining({ id: 'n1', body: 'Arrived early' }),
    ]);
    expect(d.notes[0]).not.toHaveProperty('author');
    expect(d.alerts).toEqual([]);
  });
});

describe('toListItem', () => {
  it('carries the group size and the public host shape', () => {
    const item = toListItem(visitRow as unknown as VisitListRow, 3);
    expect(item.groupSize).toBe(3);
    expect(item.host?.user).not.toHaveProperty('passwordHash');
    expect(item).toMatchObject({ id: 'v1', referenceCode: '5A19-795' });
  });
});

describe('visit existence guards', () => {
  const prismaWith = (count: number) =>
    ({
      visit: { count: jest.fn().mockResolvedValue(count) },
    }) as unknown as PrismaService;

  it('ensureExists passes for an existing visit and throws otherwise', async () => {
    await expect(ensureExists(prismaWith(1), 'v1')).resolves.toBeUndefined();
    await expect(ensureExists(prismaWith(0), 'v1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('ensureAllExist throws when any id is missing', async () => {
    await expect(
      ensureAllExist(prismaWith(2), ['v1', 'v2']),
    ).resolves.toBeUndefined();
    await expect(ensureAllExist(prismaWith(1), ['v1', 'v2'])).rejects.toThrow(
      NotFoundException,
    );
  });
});
