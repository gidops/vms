import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateUserInput,
  Paginated,
  PaginationQuery,
  UserListItem,
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
});

type UserWithRoles = Prisma.UserGetPayload<{ include: typeof accessInclude }>;

export interface UserWithAccess extends UserWithRoles {
  /** Role names, ordered by assignment (earliest first). */
  roles: string[];
  /** Union of every role's permissions (kept for reference/back-compat). */
  permissions: string[];
  /** Permission keys per role name (used to scope the active role). */
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

  /** The user's default active role: the earliest-assigned one. */
  defaultRole(user: UserWithAccess): string | null {
    return user.roles[0] ?? null;
  }

  /** Permissions granted by a single role (for active-role scoping). */
  permissionsForRole(user: UserWithAccess, role: string | null): string[] {
    if (!role) return [];
    return user.rolePermissions[role] ?? [];
  }

  /** Whether any SUPER_ADMIN user exists (gates first-run signup). */
  async roleHasUsers(roleName: string): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: { role: { name: roleName } },
    });
    return count > 0;
  }

  /** Paginated user list for the admin User Management screen. */
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

  /** All role names (for the create/edit role multi-select). */
  async listRoleNames(): Promise<string[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      select: { name: true },
    });
    return roles.map((r) => r.name);
  }

  /** Create a user with one or more roles (hashes the password). */
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

  /** Replace a user's role set. */
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

  private async resolveRoleIds(names: string[]): Promise<string[]> {
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
