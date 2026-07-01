import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ACCESS_CARD_ZONES, PERMISSIONS, ROLES } from '@vms/contracts';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from './password.service';

/**
 * Scoped roles (SUPER_ADMIN gets every permission and is handled separately).
 * VMC = the old RECEPTION ∪ CSO so the Requests & Alerts feature keeps working.
 */
const ROLE_DEFS: Record<
  string,
  { description: string; permissions: string[] }
> = {
  [ROLES.ADMIN]: {
    description:
      'Administrator — manage users and roles, decide visit requests',
    permissions: [
      PERMISSIONS.USER_READ,
      PERMISSIONS.USER_CREATE,
      PERMISSIONS.USER_UPDATE,
      PERMISSIONS.USER_DELETE,
      PERMISSIONS.ROLE_READ,
      PERMISSIONS.VISIT_APPROVE,
      PERMISSIONS.VISIT_DENY,
    ],
  },
  [ROLES.AUDITOR]: {
    description: 'Auditor — read-only access to users and records',
    permissions: [PERMISSIONS.USER_READ, PERMISSIONS.ROLE_READ],
  },
  [ROLES.STAFF]: {
    description: 'Staff member — hosts visitors, self-serves invite requests',
    permissions: [
      // Self-serve host: raise own invite requests, annotate, cancel, and
      // edit/resubmit a "needs more info" request. Host-ownership is enforced
      // in the services so these grants never reach another host's visits.
      PERMISSIONS.INVITATION_CREATE,
      PERMISSIONS.NOTE_ADD,
      PERMISSIONS.VISIT_CANCEL,
    ],
  },
  [ROLES.VMC]: {
    description: 'VMC Reception — registers visitors, logs & decides requests',
    permissions: [
      PERMISSIONS.VISITOR_REGISTER,
      PERMISSIONS.INVITATION_CREATE,
      PERMISSIONS.VISIT_CANCEL,
      PERMISSIONS.VISIT_EDIT,
      PERMISSIONS.VISIT_APPROVE,
      PERMISSIONS.VISIT_DENY,
      // Check-in/out now happen at the VMC station (badge assigned/released here).
      PERMISSIONS.VISIT_CHECK_IN,
      PERMISSIONS.VISIT_CHECK_OUT,
      PERMISSIONS.ALERT_RESOLVE,
      PERMISSIONS.ALERT_ESCALATE,
      PERMISSIONS.NOTE_ADD,
    ],
  },
  [ROLES.GATE]: {
    description: 'Gate operative — checks visitors in and out',
    permissions: [PERMISSIONS.VISIT_CHECK_IN, PERMISSIONS.VISIT_CHECK_OUT],
  },
};

// Stable IDs so demo seeding is idempotent (upsert by id).
const ID = {
  hostUser: '00000000-0000-4000-8000-000000000001',
  host: '00000000-0000-4000-8000-000000000010',
  sarahUser: '00000000-0000-4000-8000-000000000002',
  sarahHost: '00000000-0000-4000-8000-000000000011',
  visitor: (n: number) => `00000000-0000-4000-8000-0000000000${20 + n}`,
  visit: (n: number) => `00000000-0000-4000-8000-0000000000${30 + n}`,
  alert: '00000000-0000-4000-8000-000000000040',
  note: (n: number) => `00000000-0000-4000-8000-0000000000${50 + n}`,
  audit: (n: number) => `00000000-0000-4000-8000-0000000000${60 + n}`,
};

/**
 * Idempotent dev seeder: ensures the permission catalogue, the SUPER_ADMIN /
 * ADMIN / AUDITOR / STAFF / VMC / GATE roles (in every environment). No admin
 * user is seeded — the first SUPER_ADMIN is created via first-run /signup. Demo
 * requests/alerts are seeded outside production so the screens render with data.
 */
@Injectable()
export class SeederService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly passwords: PasswordService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Roles + permissions are reference data — seeded in EVERY environment so
    // the first-run /signup can assign SUPER_ADMIN. The admin USER is never
    // seeded; the first one is created through /signup.
    await this.seedRbac();
    await this.seedAccessCards();
    if (this.config.get('NODE_ENV', { infer: true }) !== 'production') {
      await this.seedDemoData();
    }
  }

  private async seedRbac(): Promise<void> {
    for (const key of Object.values(PERMISSIONS)) {
      await this.prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key },
      });
    }

    // SUPER_ADMIN holds every permission.
    const superAdminRole = await this.prisma.role.upsert({
      where: { name: ROLES.SUPER_ADMIN },
      update: { description: 'Full system access' },
      create: { name: ROLES.SUPER_ADMIN, description: 'Full system access' },
    });

    const permissions = await this.prisma.permission.findMany();
    for (const permission of permissions) {
      await this.prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: { roleId: superAdminRole.id, permissionId: permission.id },
      });
    }

    // Scoped roles (Admin, Auditor, Staff, VMC, Gate).
    const permByKey = new Map(permissions.map((p) => [p.key, p.id]));
    for (const [name, def] of Object.entries(ROLE_DEFS)) {
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

    // Drop legacy roles no longer in the canonical taxonomy (e.g. CSO,
    // RECEPTION) — their user assignments cascade away.
    const canonical = [ROLES.SUPER_ADMIN, ...Object.keys(ROLE_DEFS)];
    await this.prisma.role.deleteMany({
      where: { name: { notIn: canonical } },
    });
  }

  /**
   * Seed the physical badge pool (reference data, every environment) so the
   * check-in "Assign pass" dropdown has inventory. Idempotent by cardNumber:
   * four sequentially-numbered badges per zone, e.g. zone "5th Floor - left wing"
   * → cards 0001..0004. Only fills `zone` on create so reassigned badges aren't
   * clobbered on reboot.
   */
  private async seedAccessCards(): Promise<void> {
    let n = 0;
    for (const zone of ACCESS_CARD_ZONES) {
      for (let i = 0; i < 4; i++) {
        n += 1;
        const cardNumber = String(n).padStart(4, '0');
        await this.prisma.accessCard.upsert({
          where: { cardNumber },
          update: {},
          create: { cardNumber, zone },
        });
      }
    }
  }

  /**
   * Idempotent demo requests + an alert so the inbox isn't empty in dev. Author
   * is the seeded host user (Dr Alabi), so demo data needs no admin account.
   */
  private async seedDemoData(): Promise<void> {
    const defaultHash = await this.passwords.hash('Passw0rd!');

    const hostUser = await this.prisma.user.upsert({
      where: { id: ID.hostUser },
      update: {},
      create: {
        id: ID.hostUser,
        email: 'dr.alabi@aatc.org',
        fullName: 'Dr Alabi Oluwaseun',
        passwordHash: defaultHash,
      },
    });
    if (!hostUser.passwordHash) {
      await this.prisma.user.update({
        where: { id: hostUser.id },
        data: { passwordHash: defaultHash },
      });
    }
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

    // Host users must carry the STAFF role to appear in the invite host picker.
    const staffRole = await this.prisma.role.findUnique({
      where: { name: ROLES.STAFF },
    });
    if (staffRole) await this.assignRole(hostUser.id, staffRole.id);

    // A second STAFF host so the host dropdown has options (matches the mockups).
    const sarah = await this.prisma.user.upsert({
      where: { id: ID.sarahUser },
      update: {},
      create: {
        id: ID.sarahUser,
        email: 'sarah.lee@aatc.org',
        fullName: 'Sarah Lee',
        passwordHash: defaultHash,
      },
    });
    if (!sarah.passwordHash) {
      await this.prisma.user.update({
        where: { id: sarah.id },
        data: { passwordHash: defaultHash },
      });
    }
    await this.prisma.host.upsert({
      where: { id: ID.sarahHost },
      update: {},
      create: {
        id: ID.sarahHost,
        userId: sarah.id,
        department: 'Finance',
        office: 'Floor Mezzanine',
      },
    });
    if (staffRole) await this.assignRole(sarah.id, staffRole.id);

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

    // A spread of statuses (all hosted by Dr Alabi) so the staff dashboard's
    // stats, My Visits filters and the lifecycle stepper all have data. `today`
    // schedules the visit for now so "Expected Today" / date filters are non-empty.
    const visitSeeds: {
      visitorIdx: number;
      status:
        | 'PENDING'
        | 'NEEDS_MORE_INFO'
        | 'APPROVED'
        | 'DENIED'
        | 'CHECKED_IN'
        | 'CHECKED_OUT'
        | 'CANCELLED';
      purpose: string;
      today?: boolean;
    }[] = [
      { visitorIdx: 1, status: 'PENDING', purpose: 'Private Meeting' },
      {
        visitorIdx: 0,
        status: 'APPROVED',
        purpose: 'Client Meeting',
        today: true,
      },
      { visitorIdx: 2, status: 'NEEDS_MORE_INFO', purpose: 'General Enquiry' },
      { visitorIdx: 3, status: 'DENIED', purpose: 'Client Meeting' },
      { visitorIdx: 0, status: 'CHECKED_IN', purpose: 'Official', today: true },
      { visitorIdx: 1, status: 'CHECKED_OUT', purpose: 'Delivery' },
    ];
    for (let i = 0; i < visitSeeds.length; i++) {
      const seed = visitSeeds[i];
      const scheduledAt = seed.today
        ? new Date()
        : new Date('2026-06-12T10:00:00Z');
      const checkInAt = seed.status === 'CHECKED_IN' ? new Date() : null;
      await this.prisma.visit.upsert({
        where: { id: ID.visit(i) },
        // Demo rows are owned by the seeder: refresh their status/schedule on
        // every boot so taxonomy changes (e.g. NEEDS_MORE_INFO) take effect.
        update: { status: seed.status, scheduledAt, checkInAt },
        create: {
          id: ID.visit(i),
          visitorId: visitors[seed.visitorIdx].id,
          hostId: host.id,
          type: 'PRE_INVITED',
          status: seed.status,
          purpose: seed.purpose,
          source: 'VMC_STATION',
          createdById: hostUser.id,
          createdByName: hostUser.fullName,
          checkInAt,
          scheduledAt,
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
        raisedById: hostUser.id,
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
          authorId: hostUser.id,
          authorName: hostUser.fullName,
          body: noteBodies[i],
        },
      });
    }

    // Seed audit rows so the staff "Recent Updates" feed (read from AuditLog)
    // renders in dev. In normal operation these are written by the AuditListener
    // as events flow; demo data is inserted directly so it needs them explicitly.
    const auditSeeds: {
      action: string;
      entityType: string;
      entityId: string;
    }[] = [
      { action: 'visit.approved', entityType: 'Visit', entityId: ID.visit(1) },
      {
        action: 'visitor.checked_in',
        entityType: 'Visit',
        entityId: ID.visit(4),
      },
      {
        action: 'visitor.checked_out',
        entityType: 'Visit',
        entityId: ID.visit(5),
      },
      { action: 'visit.denied', entityType: 'Visit', entityId: ID.visit(3) },
      { action: 'note.added', entityType: 'Visit', entityId: ID.visit(2) },
      { action: 'alert.updated', entityType: 'Alert', entityId: ID.alert },
    ];
    for (let i = 0; i < auditSeeds.length; i++) {
      const seed = auditSeeds[i];
      await this.prisma.auditLog.upsert({
        where: { id: ID.audit(i) },
        update: {},
        create: {
          id: ID.audit(i),
          action: seed.action,
          eventType: seed.action,
          entityType: seed.entityType,
          entityId: seed.entityId,
          actorUserId: hostUser.id,
        },
      });
    }
  }

  /** Idempotently grant a role to a user (composite-key upsert). */
  private async assignRole(userId: string, roleId: string): Promise<void> {
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  }
}
