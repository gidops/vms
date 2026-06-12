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

/** Roles beyond ADMIN, with their permission sets. */
const ROLES: Record<string, { description: string; permissions: string[] }> = {
  CSO: {
    description:
      'Chief Security Officer — approves/denies visits, resolves alerts',
    permissions: [
      PERMISSIONS.VISIT_APPROVE,
      PERMISSIONS.VISIT_DENY,
      PERMISSIONS.ALERT_RESOLVE,
      PERMISSIONS.ALERT_ESCALATE,
      PERMISSIONS.NOTE_ADD,
    ],
  },
  RECEPTION: {
    description: 'VMC Reception — registers visitors and logs visit requests',
    permissions: [
      PERMISSIONS.VISITOR_REGISTER,
      PERMISSIONS.INVITATION_CREATE,
      PERMISSIONS.VISIT_CANCEL,
      PERMISSIONS.VISIT_EDIT,
      PERMISSIONS.NOTE_ADD,
    ],
  },
};

// Stable IDs so demo seeding is idempotent (upsert by id).
const ID = {
  hostUser: '00000000-0000-4000-8000-000000000001',
  host: '00000000-0000-4000-8000-000000000010',
  visitor: (n: number) => `00000000-0000-4000-8000-0000000000${20 + n}`,
  visit: (n: number) => `00000000-0000-4000-8000-0000000000${30 + n}`,
  alert: '00000000-0000-4000-8000-000000000040',
  note: (n: number) => `00000000-0000-4000-8000-0000000000${50 + n}`,
};

/**
 * Idempotent dev seeder: ensures the permission catalogue, the ADMIN/CSO/
 * RECEPTION roles, a default admin user, and a set of demo requests/alerts so
 * the Requests & Alerts screens render against real data. Skipped in production.
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

    // Additional roles (CSO, Reception) with scoped permission sets.
    const permByKey = new Map(permissions.map((p) => [p.key, p.id]));
    for (const [name, def] of Object.entries(ROLES)) {
      const role = await this.prisma.role.upsert({
        where: { name },
        update: { description: def.description },
        create: { name, description: def.description },
      });
      for (const key of def.permissions) {
        const permissionId = permByKey.get(key);
        if (!permissionId) continue;
        await this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId },
          },
          update: {},
          create: { roleId: role.id, permissionId },
        });
      }
    }

    let adminUserId: string;
    const existing = await this.prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
    });
    if (existing) {
      adminUserId = existing.id;
    } else {
      const passwordHash = await this.passwords.hash(ADMIN_PASSWORD);
      const user = await this.prisma.user.create({
        data: { email: ADMIN_EMAIL, fullName: 'AATC Admin', passwordHash },
      });
      await this.prisma.userRole.create({
        data: { userId: user.id, roleId: adminRole.id },
      });
      adminUserId = user.id;
      this.logger.log(
        `Seeded admin user ${ADMIN_EMAIL} (password: ${ADMIN_PASSWORD})`,
      );
    }

    await this.seedDemoData(adminUserId);
  }

  /** Idempotent demo requests + an alert so the inbox isn't empty in dev. */
  private async seedDemoData(adminUserId: string): Promise<void> {
    const hostUser = await this.prisma.user.upsert({
      where: { id: ID.hostUser },
      update: {},
      create: {
        id: ID.hostUser,
        email: 'dr.alabi@aatc.org',
        fullName: 'Dr Alabi Oluwaseun',
      },
    });
    const host = await this.prisma.host.upsert({
      where: { id: ID.host },
      update: {},
      create: {
        id: ID.host,
        userId: hostUser.id,
        department: 'Real Estate and Administration, AATC',
        office: '3RD FLOOR - LW',
      },
    });

    const visitorSeeds = [
      {
        fullName: 'Sophia Davis',
        email: 'sophie@gmail.com',
        organization: 'AMAC Group of Companies',
        phone: '+1 860-695 1009',
      },
      {
        fullName: 'Mr Jude',
        email: 'jude@standardchartered.com',
        organization: 'Standard Chartered Bank',
      },
      {
        fullName: 'Mercy Nwanja',
        email: 'mercy@eventsdeluxe.com',
        organization: 'EVENTS DELUXE BY JAY',
      },
      {
        fullName: 'Mr Chris',
        email: 'chris@vendor.com',
        organization: 'Vendor-VN093',
      },
    ];
    const visitors: { id: string }[] = [];
    for (let i = 0; i < visitorSeeds.length; i++) {
      const seed = visitorSeeds[i];
      visitors.push(
        await this.prisma.visitor.upsert({
          where: { id: ID.visitor(i) },
          update: {},
          create: { id: ID.visitor(i), ...seed },
        }),
      );
    }

    const visitSeeds: {
      visitorIdx: number;
      status: 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED';
      purpose: string;
    }[] = [
      { visitorIdx: 1, status: 'PENDING', purpose: 'Private Meeting' },
      { visitorIdx: 0, status: 'APPROVED', purpose: 'Client Meeting' },
      { visitorIdx: 2, status: 'PENDING', purpose: 'General Enquiry' },
      { visitorIdx: 3, status: 'DENIED', purpose: 'Client Meeting' },
    ];
    for (let i = 0; i < visitSeeds.length; i++) {
      const seed = visitSeeds[i];
      await this.prisma.visit.upsert({
        where: { id: ID.visit(i) },
        update: {},
        create: {
          id: ID.visit(i),
          visitorId: visitors[seed.visitorIdx].id,
          hostId: host.id,
          type: 'PRE_INVITED',
          status: seed.status,
          purpose: seed.purpose,
          source: 'VMC_STATION',
          createdById: adminUserId,
          scheduledAt: new Date('2026-06-12T10:00:00Z'),
        },
      });
    }

    await this.prisma.alert.upsert({
      where: { id: ID.alert },
      update: {},
      create: {
        id: ID.alert,
        visitorId: visitors[1].id,
        level: 'HIGH',
        status: 'OPEN',
        reason:
          'This visitor matches a flagged profile and requires CSO review.',
        category: 'Flagged Visitor Match',
        raisedById: adminUserId,
      },
    });

    // A couple of notes on the first (pending) request.
    const noteBodies = [
      'Visitor details were provided by Dr Alabi via email.',
      'Awaiting CSO confirmation before issuing a pass.',
    ];
    for (let i = 0; i < noteBodies.length; i++) {
      await this.prisma.note.upsert({
        where: { id: ID.note(i) },
        update: {},
        create: {
          id: ID.note(i),
          visitId: ID.visit(0),
          authorId: adminUserId,
          body: noteBodies[i],
        },
      });
    }
  }
}
