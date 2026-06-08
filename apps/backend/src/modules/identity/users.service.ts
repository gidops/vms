import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const accessInclude = Prisma.validator<Prisma.UserInclude>()({
  userRoles: {
    include: {
      role: { include: { rolePermissions: { include: { permission: true } } } },
    },
  },
});

type UserWithRoles = Prisma.UserGetPayload<{ include: typeof accessInclude }>;

export interface UserWithAccess extends UserWithRoles {
  roles: string[];
  permissions: string[];
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  private withAccess(user: UserWithRoles): UserWithAccess {
    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.key),
        ),
      ),
    ];
    return { ...user, roles, permissions };
  }
}
