import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PERMISSIONS } from '@vms/contracts';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from './password.service';

const ADMIN_EMAIL = 'admin@aatc.org';
const ADMIN_PASSWORD = 'Passw0rd!';

/**
 * Idempotent dev seeder: ensures the permission catalogue, an ADMIN role with
 * all permissions, and a default admin user exist so you can log in immediately.
 * Skipped in production.
 */
@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get('NODE_ENV', { infer: true }) === 'production') return;
    await this.seed();
  }

  private async seed(): Promise<void> {
    for (const key of Object.values(PERMISSIONS)) {
      await this.prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key },
      });
    }

    const adminRole = await this.prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN', description: 'Full system access' },
    });

    const permissions = await this.prisma.permission.findMany();
    for (const permission of permissions) {
      await this.prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: { roleId: adminRole.id, permissionId: permission.id },
      });
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
    });
    if (!existing) {
      const passwordHash = await this.passwords.hash(ADMIN_PASSWORD);
      const user = await this.prisma.user.create({
        data: { email: ADMIN_EMAIL, fullName: 'AATC Admin', passwordHash },
      });
      await this.prisma.userRole.create({
        data: { userId: user.id, roleId: adminRole.id },
      });
      this.logger.log(
        `Seeded admin user ${ADMIN_EMAIL} (password: ${ADMIN_PASSWORD})`,
      );
    }
  }
}
