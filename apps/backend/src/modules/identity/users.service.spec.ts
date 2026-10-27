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
