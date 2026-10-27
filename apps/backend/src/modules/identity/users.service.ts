import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ADDON_ROLES,
  isAddonRole,
  ROLES,
  type CreateUserInput,
  type HostOption,
  type PublicHostOption,
  type LoginActivityItem,
  type Paginated,
  type PaginationQuery,
  type UpdateMeInput,
  type UserListItem,
} from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';
import { PasswordService } from '../../shared/auth/password.service';

const accessInclude = Prisma.validator<Prisma.UserInclude>()({
  userRoles: {
    include: {
      role: { include: { rolePermissions: { include: { permission: true } } } },
    },
  },

  host: { select: { department: true, office: true } },
});

type UserWithRoles = Prisma.UserGetPayload<{ include: typeof accessInclude }>;

export interface UserWithAccess extends UserWithRoles {
  roles: string[];
  permissions: string[];
  rolePermissions: Record<string, string[]>;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
  ) {}

  async findByEmailWithAccess(email: string): Promise<UserWithAccess | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: accessInclude,
    });
    return user ? this.withAccess(user) : null;
  }

  async findByIdWithAccess(id: string): Promise<UserWithAccess | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: accessInclude,
    });
    return user ? this.withAccess(user) : null;
  }

  defaultRole(user: UserWithAccess): string | null {
    return user.roles.find((r) => !isAddonRole(r)) ?? null;
  }

  // Add-ons extend their base role: READ_ADMIN on STAFF, VMC_ADMIN on VMC.
  permissionsForRole(user: UserWithAccess, role: string | null): string[] {
    if (!role) return [];
    const addons = user.roles.filter((r) => ADDON_ROLES[r] === role);
    return [
      ...new Set(
        [role, ...addons].flatMap((r) => user.rolePermissions[r] ?? []),
      ),
    ];
  }

  /** Whether any SUPER_ADMIN user exists (gates first-run signup). */
  async roleHasUsers(roleName: string): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: { role: { name: roleName } },
    });
    return count > 0;
  }

  async list(query: PaginationQuery): Promise<Paginated<UserListItem>> {
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { userRoles: { include: { role: true } } },
      }),
      this.prisma.user.count(),
    ]);
    return {
      items: rows.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        isActive: u.isActive,
        roles: u.userRoles.map((ur) => ur.role.name),
        createdAt: u.createdAt,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async listHosts(): Promise<HostOption[]> {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        userRoles: { some: { role: { name: ROLES.STAFF } } },
      },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        host: { select: { department: true, office: true } },
      },
    });
    return users.map((u) => ({
      userId: u.id,
      fullName: u.fullName,
      email: u.email,
      department: u.host?.department ?? null,
      office: u.host?.office ?? null,
    }));
  }

  // Public endpoint: return name and department only, never contact details.
  async searchPublicHosts(
    query: string,
    take = 8,
  ): Promise<PublicHostOption[]> {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        userRoles: { some: { role: { name: ROLES.STAFF } } },
        fullName: { contains: query, mode: 'insensitive' },
      },
      orderBy: { fullName: 'asc' },
      take,
      select: {
        id: true,
        fullName: true,
        host: { select: { department: true } },
      },
    });
    return users.map((u) => ({
      userId: u.id,
      fullName: u.fullName,
      department: u.host?.department ?? null,
    }));
  }

  async isActiveHost(userId: string): Promise<boolean> {
    const n = await this.prisma.user.count({
      where: {
        id: userId,
        isActive: true,
        userRoles: { some: { role: { name: ROLES.STAFF } } },
      },
    });
    return n > 0;
  }

  async listRoleNames(): Promise<string[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      select: { name: true },
    });
    return roles.map((r) => r.name);
  }

  async create(
    input: CreateUserInput,
    actorUserId?: string,
  ): Promise<UserWithAccess> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) throw new BadRequestException('Email already in use');

    const roleIds = await this.resolveRoleIds(input.roles);
    const passwordHash = await this.passwords.hash(input.password);

    const userId = await this.txm.run(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, fullName: input.fullName, passwordHash },
      });
      // Stagger assignedAt so the first listed role is the default active role.
      const base = Date.now();
      await tx.userRole.createMany({
        data: roleIds.map((roleId, i) => ({
          userId: user.id,
          roleId,
          assignedAt: new Date(base + i),
        })),
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.UserCreated,
        aggregateType: 'User',
        aggregateId: user.id,
        payload: { email: user.email, roles: input.roles },
        metadata: { actorUserId: actorUserId ?? user.id },
      });
      return user.id;
    });

    const created = await this.findByIdWithAccess(userId);
    if (!created) throw new NotFoundException('User not found after create');
    return created;
  }

  async updateRoles(
    id: string,
    roles: string[],
    actorUserId: string,
  ): Promise<UserWithAccess> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const roleIds = await this.resolveRoleIds(roles);

    await this.txm.run(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      const base = Date.now();
      await tx.userRole.createMany({
        data: roleIds.map((roleId, i) => ({
          userId: id,
          roleId,
          assignedAt: new Date(base + i),
        })),
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.UserRolesUpdated,
        aggregateType: 'User',
        aggregateId: id,
        payload: { roles },
        metadata: { actorUserId },
      });
    });

    const updated = await this.findByIdWithAccess(id);
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async updateMe(
    userId: string,
    input: UpdateMeInput,
  ): Promise<UserWithAccess> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const data: Prisma.UserUpdateInput = {};
    if (input.firstName !== undefined) data.firstName = input.firstName;
    if (input.lastName !== undefined) data.lastName = input.lastName;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.preferredLocale !== undefined)
      data.preferredLocale = input.preferredLocale;
    if (input.timezone !== undefined) data.timezone = input.timezone;
    if (input.assignedDesk !== undefined)
      data.assignedDesk = input.assignedDesk;

    if (input.firstName !== undefined || input.lastName !== undefined) {
      const first = input.firstName ?? user.firstName ?? '';
      const last = input.lastName ?? user.lastName ?? '';
      const full = `${first} ${last}`.trim();
      if (full) data.fullName = full;
    }

    if (input.notificationPrefs !== undefined) {
      const existing =
        (user.notificationPrefs as Record<string, boolean> | null) ?? {};
      data.notificationPrefs = {
        ...existing,
        ...input.notificationPrefs,
      };
    }

    await this.txm.run(async (tx) => {
      await tx.user.update({ where: { id: userId }, data });
      await this.events.publish(tx, {
        type: EVENT_TYPES.UserProfileUpdated,
        aggregateType: 'User',
        aggregateId: userId,
        payload: { fields: Object.keys(data) },
        metadata: { actorUserId: userId },
      });
    });

    const fresh = await this.findByIdWithAccess(userId);
    if (!fresh) throw new NotFoundException('User not found');
    return fresh;
  }

  async setAvatar(userId: string, avatarKey: string): Promise<UserWithAccess> {
    await this.txm.run(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { avatarKey } });
      await this.events.publish(tx, {
        type: EVENT_TYPES.UserProfileUpdated,
        aggregateType: 'User',
        aggregateId: userId,
        payload: { fields: ['avatarKey'] },
        metadata: { actorUserId: userId },
      });
    });
    const fresh = await this.findByIdWithAccess(userId);
    if (!fresh) throw new NotFoundException('User not found');
    return fresh;
  }

  async listSessions(
    userId: string,
    currentSessionId: string | undefined,
  ): Promise<LoginActivityItem[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
    });
    return sessions.map((s) => {
      const { os, browser } = parseUserAgent(s.userAgent);
      return {
        id: s.id,
        os,
        browser,
        location: s.ip ?? null,
        lastSeenAt: s.lastSeenAt,
        current: s.id === currentSessionId,
      };
    });
  }

  /** Authored records survive (SetNull FKs, denormalized names); blocked for self, the last Super Admin, and hosts. */
  async deleteUser(id: string, actorUserId: string): Promise<void> {
    if (id === actorUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    const target = await this.prisma.user.findUnique({
      where: { id },
      include: { host: true, userRoles: { include: { role: true } } },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.host) {
      throw new BadRequestException(
        'This user is a host with visit records and cannot be deleted',
      );
    }
    const isSuperAdmin = target.userRoles.some(
      (ur) => ur.role.name === ROLES.SUPER_ADMIN,
    );
    if (isSuperAdmin) {
      const superAdmins = await this.prisma.userRole.count({
        where: { role: { name: ROLES.SUPER_ADMIN } },
      });
      if (superAdmins <= 1) {
        throw new BadRequestException('Cannot delete the last Super Admin');
      }
    }

    await this.txm.run(async (tx) => {
      await this.events.publish(tx, {
        type: EVENT_TYPES.UserDeleted,
        aggregateType: 'User',
        aggregateId: id,
        payload: { email: target.email },
        metadata: { actorUserId },
      });
      await tx.user.delete({ where: { id } });
    });
  }

  private async resolveRoleIds(requested: string[]): Promise<string[]> {
    // An add-on only extends its base role, so it needs that role alongside it.
    for (const name of requested) {
      const base = ADDON_ROLES[name];
      if (base && !requested.includes(base)) {
        throw new BadRequestException(
          `${name} is an add-on for ${base}; assign ${base} as well`,
        );
      }
    }
    // Add-ons go last so the first listed base role stays the default.
    const names = [
      ...requested.filter((r) => !isAddonRole(r)),
      ...requested.filter(isAddonRole),
    ];
    const roles = await this.prisma.role.findMany({
      where: { name: { in: names } },
    });
    const byName = new Map(roles.map((r) => [r.name, r.id]));
    // Preserve the caller's order so the first name is the default role.
    return names.map((name) => {
      const id = byName.get(name);
      if (!id) throw new BadRequestException(`Unknown role: ${name}`);
      return id;
    });
  }

  private withAccess(user: UserWithRoles): UserWithAccess {
    const ordered = [...user.userRoles].sort((a, b) => {
      const t = a.assignedAt.getTime() - b.assignedAt.getTime();
      return t !== 0 ? t : a.role.name.localeCompare(b.role.name);
    });
    const roles = ordered.map((ur) => ur.role.name);
    const rolePermissions: Record<string, string[]> = {};
    for (const ur of ordered) {
      rolePermissions[ur.role.name] = ur.role.rolePermissions.map(
        (rp) => rp.permission.key,
      );
    }
    const permissions = [...new Set(Object.values(rolePermissions).flat())];
    return { ...user, roles, permissions, rolePermissions };
  }
}

/** Best-effort OS + browser extraction from a User-Agent string. */
function parseUserAgent(ua: string | null): { os: string; browser: string } {
  if (!ua) return { os: 'Unknown', browser: 'Unknown' };
  const os = /Windows/i.test(ua)
    ? 'Windows'
    : /Mac OS X|Macintosh/i.test(ua)
      ? 'macOS'
      : /Android/i.test(ua)
        ? 'Android'
        : /iPhone|iPad|iOS/i.test(ua)
          ? 'iOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Unknown';
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /Chrome|CriOS/i.test(ua)
      ? 'Chrome'
      : /Firefox/i.test(ua)
        ? 'Firefox'
        : /Safari/i.test(ua)
          ? 'Safari'
          : 'Unknown';
  return { os, browser };
}
