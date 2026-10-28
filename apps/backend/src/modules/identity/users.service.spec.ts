import { BadRequestException } from '@nestjs/common';
import { UsersService, type UserWithAccess } from './users.service';

describe('UsersService — add-on roles', () => {
  let prisma: any;
  let txm: any;
  let tx: any;
  let svc: UsersService;

  const access = (rolePermissions: Record<string, string[]>) =>
    ({
      roles: Object.keys(rolePermissions),
      rolePermissions,
    }) as unknown as UserWithAccess;

  beforeEach(() => {
    tx = {
      userRole: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1' }) },
      role: {
        findMany: jest.fn(({ where }: { where: { name: { in: string[] } } }) =>
          where.name.in.map((name) => ({ id: `id-${name}`, name })),
        ),
      },
    };
    txm = { run: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)) };
    svc = new UsersService(prisma, {} as never, txm, {
      publish: jest.fn(),
    } as never);
    jest
      .spyOn(svc, 'findByIdWithAccess')
      .mockResolvedValue({ id: 'u1' } as never);
  });

  it('merges an add-on into its base role only', () => {
    const user = access({
      STAFF: ['insights:self'],
      READ_ADMIN: ['overview:read', 'insights:self'],
      ADMIN: ['user:read'],
    });
    expect(svc.permissionsForRole(user, 'STAFF').sort()).toEqual([
      'insights:self',
      'overview:read',
    ]);
    expect(svc.permissionsForRole(user, 'ADMIN')).toEqual(['user:read']);
    expect(svc.permissionsForRole(user, null)).toEqual([]);
  });

  it('never defaults to an add-on role', () => {
    expect(svc.defaultRole(access({ READ_ADMIN: [], STAFF: [] }))).toBe(
      'STAFF',
    );
    expect(svc.defaultRole(access({ VMC_ADMIN: [] }))).toBeNull();
  });

  it('rejects an add-on without its base role', async () => {
    await expect(
      svc.updateRoles('u1', ['READ_ADMIN'], 'actor'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.updateRoles('u1', ['STAFF', 'VMC_ADMIN'], 'actor'),
    ).rejects.toThrow(/VMC_ADMIN is an add-on for VMC/);
    expect(tx.userRole.createMany).not.toHaveBeenCalled();
  });

  it('stores add-ons after base roles so a base role stays the default', async () => {
    await svc.updateRoles('u1', ['READ_ADMIN', 'STAFF', 'ADMIN'], 'actor');
    const rows = tx.userRole.createMany.mock.calls[0][0].data as {
      roleId: string;
    }[];
    expect(rows.map((r) => r.roleId)).toEqual([
      'id-STAFF',
      'id-ADMIN',
      'id-READ_ADMIN',
    ]);
  });
});

describe('UsersService.setStatus', () => {
  let prisma: any;
  let tx: any;
  let txm: any;
  let publish: jest.Mock;
  let svc: UsersService;

  const target = (roles: string[], isActive = true) => ({
    id: 'u2',
    isActive,
    userRoles: roles.map((name) => ({ role: { name } })),
  });

  beforeEach(() => {
    tx = {
      user: { update: jest.fn() },
      refreshToken: { updateMany: jest.fn() },
      session: { updateMany: jest.fn() },
    };
    prisma = {
      user: { findUnique: jest.fn() },
      userRole: { count: jest.fn() },
    };
    txm = { run: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)) };
    publish = jest.fn();
    svc = new UsersService(prisma, {} as never, txm, { publish } as never);
    jest.spyOn(svc, 'getDetail').mockResolvedValue({ id: 'u2' } as never);
  });

  it('blocks deactivating your own account', async () => {
    await expect(svc.setStatus('u2', false, 'u2')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(txm.run).not.toHaveBeenCalled();
  });

  it('blocks deactivating the last active Super Admin', async () => {
    prisma.user.findUnique.mockResolvedValue(target(['SUPER_ADMIN']));
    prisma.userRole.count.mockResolvedValue(1);
    await expect(svc.setStatus('u2', false, 'admin1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('deactivation revokes sessions and publishes user.status_changed', async () => {
    prisma.user.findUnique.mockResolvedValue(target(['STAFF']));
    await svc.setStatus('u2', false, 'admin1');
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u2' },
      data: { isActive: false },
    });
    expect(tx.refreshToken.updateMany).toHaveBeenCalled();
    expect(tx.session.updateMany).toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: 'user.status_changed',
        aggregateId: 'u2',
        payload: { isActive: false },
        metadata: { actorUserId: 'admin1' },
      }),
    );
  });

  it('reactivation keeps sessions untouched and is a no-op when already active', async () => {
    prisma.user.findUnique.mockResolvedValue(target(['STAFF'], false));
    await svc.setStatus('u2', true, 'admin1');
    expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(tx.session.updateMany).not.toHaveBeenCalled();

    prisma.user.findUnique.mockResolvedValue(target(['STAFF'], true));
    txm.run.mockClear();
    await svc.setStatus('u2', true, 'admin1');
    expect(txm.run).not.toHaveBeenCalled();
  });
});

describe('UsersService.adminUpdate', () => {
  let prisma: any;
  let tx: any;
  let publish: jest.Mock;
  let svc: UsersService;

  beforeEach(() => {
    tx = { user: { update: jest.fn() } };
    prisma = { user: { findUnique: jest.fn() } };
    const txm = { run: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)) };
    publish = jest.fn();
    svc = new UsersService(
      prisma,
      {} as never,
      txm as never,
      {
        publish,
      } as never,
    );
    jest.spyOn(svc, 'getDetail').mockResolvedValue({ id: 'u2' } as never);
  });

  it('keeps the surname of a full-name-only account when only the first name changes', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      fullName: 'Insights ins-gate',
      firstName: null,
      lastName: null,
    });
    await svc.adminUpdate('u2', { firstName: 'Gate' }, 'admin1');
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u2' },
      data: {
        firstName: 'Gate',
        lastName: 'ins-gate',
        fullName: 'Gate ins-gate',
      },
    });
  });

  it('updates phone alone without touching names', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      fullName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    await svc.adminUpdate('u2', { phone: '+2348031234567' }, 'admin1');
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u2' },
      data: { phone: '+2348031234567' },
    });
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ payload: { fields: ['phone'] } }),
    );
  });

  it('rejects an empty update', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u2', fullName: 'A' });
    await expect(svc.adminUpdate('u2', {}, 'admin1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('UsersService.list filters', () => {
  it('builds the where clause from search, role and status', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const svc = new UsersService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await svc.list({
      page: 1,
      pageSize: 10,
      sortDir: 'desc',
      search: 'gideon',
      role: 'STAFF',
      status: 'inactive',
    });
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { fullName: { contains: 'gideon', mode: 'insensitive' } },
      { email: { contains: 'gideon', mode: 'insensitive' } },
    ]);
    expect(where.userRoles).toEqual({ some: { role: { name: 'STAFF' } } });
    expect(where.isActive).toBe(false);
    // The count must apply the same filter or totals lie.
    expect(prisma.user.count).toHaveBeenCalledWith({ where });
  });
});

describe('UsersService.setAvatar', () => {
  it('saves the key and publishes a profile-updated event in one transaction', async () => {
    const tx = { user: { update: jest.fn() } };
    const txm = { run: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)) };
    const publish = jest.fn();
    const svc = new UsersService(
      {} as never,
      {} as never,
      txm as never,
      {
        publish,
      } as never,
    );
    jest
      .spyOn(svc, 'findByIdWithAccess')
      .mockResolvedValue({ id: 'u1' } as never);

    await svc.setAvatar('u1', 'avatars/u1.png');

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { avatarKey: 'avatars/u1.png' },
    });
    expect(publish).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: 'user.profile_updated',
        aggregateId: 'u1',
        payload: { fields: ['avatarKey'] },
      }),
    );
  });
});
