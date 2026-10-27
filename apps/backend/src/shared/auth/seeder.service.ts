import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ACCESS_CARD_ZONES, PERMISSIONS, ROLES } from '@vms/contracts';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';

/** SUPER_ADMIN gets every permission and is handled separately. */
const ROLE_DEFS: Record<
  string,
  { description: string; permissions: string[] }
> = {
  [ROLES.ADMIN]: {
    description:
      'Security Manager — decide/flag visit requests, analytics, bulk exports',
    permissions: [
      // No user:* / role:read: users and roles belong to the System Admin.
      PERMISSIONS.VISIT_READ,
      PERMISSIONS.VISIT_APPROVE,
      PERMISSIONS.VISIT_DENY,
      PERMISSIONS.VISIT_FLAG,
      PERMISSIONS.VISIT_REQUEST_INFO,
      PERMISSIONS.ALERT_RESOLVE,
      PERMISSIONS.ALERT_ESCALATE,
      PERMISSIONS.NOTE_ADD,
      PERMISSIONS.EVACUATION_READ,
      PERMISSIONS.HISTORY_READ,
      PERMISSIONS.VISITOR_READ,
      PERMISSIONS.REPORT_READ,
      // Read-only: reception withdraws consent, the System Admin grants it.
      PERMISSIONS.CONSENT_READ,
      // Bulk personal-data exports: never granted to Read Admin, Staff or Gate.
      PERMISSIONS.CONSENT_EXPORT,
      PERMISSIONS.REPORT_EXPORT,
      PERMISSIONS.NOTIFICATION_READ,
      PERMISSIONS.NOTIFICATION_RETRY,
    ],
  },
  // Add-ons merge into their base role, so they list only what it lacks.
  [ROLES.VMC_ADMIN]: {
    description:
      'VMC Admin — add-on for VMC: visitor directory and analytics on Insights',
    permissions: [PERMISSIONS.VISITOR_READ, PERMISSIONS.REPORT_READ],
  },
  [ROLES.READ_ADMIN]: {
    description:
      'Read Admin — add-on for Staff: facility-wide Insights, read only; no personal-data exports',
    permissions: [
      PERMISSIONS.OVERVIEW_READ,
      PERMISSIONS.HISTORY_READ,
      PERMISSIONS.VISITOR_READ,
      PERMISSIONS.REPORT_READ,
      PERMISSIONS.CONSENT_READ,
    ],
  },
  [ROLES.STAFF]: {
    description: 'Staff member — hosts visitors, self-serves invite requests',
    permissions: [
      // Ownership is enforced in the services; no visit:read, so staff see only their own visits.
      PERMISSIONS.INVITATION_CREATE,
      PERMISSIONS.NOTE_ADD,
      PERMISSIONS.VISIT_CANCEL,
      PERMISSIONS.INSIGHTS_SELF,
    ],
  },
  [ROLES.VMC]: {
    description: 'VMC Reception — registers visitors and checks them in/out',
    permissions: [
      PERMISSIONS.VISIT_READ,
      PERMISSIONS.VISITOR_REGISTER,
      PERMISSIONS.INVITATION_CREATE,
      PERMISSIONS.VISIT_CANCEL,
      PERMISSIONS.VISIT_EDIT,
      // Reception never approves or denies requests.
      PERMISSIONS.VISIT_CHECK_IN,
      PERMISSIONS.VISIT_CHECK_OUT,
      // Notes only: resolving an alert (which unblocks check-in) is the Security Manager's call.
      PERMISSIONS.NOTE_ADD,
      PERMISSIONS.EVACUATION_READ,
      PERMISSIONS.HISTORY_READ,
      PERMISSIONS.CONSENT_READ,
      PERMISSIONS.CONSENT_MANAGE,
      PERMISSIONS.CONSENT_EXPORT,
      PERMISSIONS.REPORT_EXPORT,
      PERMISSIONS.NOTIFICATION_READ,
      PERMISSIONS.NOTIFICATION_RETRY,
    ],
  },
  [ROLES.GATE]: {
    description: 'Gate operative — checks visitors in and out',
    permissions: [
      PERMISSIONS.VISIT_CHECK_IN,
      PERMISSIONS.VISIT_CHECK_OUT,
      // Gate staff may be first responders in an evacuation.
      PERMISSIONS.EVACUATION_READ,
    ],
  },
};

/** Exposed for tests. */
export const SCOPED_ROLE_DEFS = ROLE_DEFS;

// Stable IDs so demo seeding is idempotent (upsert by id).
const ID = {
  hostUser: '00000000-0000-4000-8000-000000000001',
  host: '00000000-0000-4000-8000-000000000010',
  sarahUser: '00000000-0000-4000-8000-000000000002',
  sarahHost: '00000000-0000-4000-8000-000000000011',
  visitor: (n: number) => `00000000-0000-4000-8000-0000000000${20 + n}`,
  visit: (n: number) => `00000000-0000-4000-8000-0000000000${30 + n}`,
  alert: (n: number) => `00000000-0000-4000-8000-0000000000${40 + n}`,
  note: (n: number) => `00000000-0000-4000-8000-0000000000${50 + n}`,
  audit: (n: number) => `00000000-0000-4000-8000-0000000000${60 + n}`,
};

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Seeded in every environment so first-run /signup can assign SUPER_ADMIN; no admin user is seeded.
    await this.seedRbac();
    await this.seedAccessCards();
    if (this.config.get('SEED_DEMO_DATA', { infer: true })) {
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

    const superAdminRole = await this.prisma.role.upsert({
      where: { name: ROLES.SUPER_ADMIN },
      update: { description: 'System Admin — full system access' },
      create: {
        name: ROLES.SUPER_ADMIN,
        description: 'System Admin — full system access',
      },
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

    const permByKey = new Map(permissions.map((p) => [p.key, p.id]));
    for (const [name, def] of Object.entries(ROLE_DEFS)) {
      const role = await this.prisma.role.upsert({
        where: { name },
        update: { description: def.description },
        create: { name, description: def.description },
      });
      const desiredIds: string[] = [];
      for (const key of def.permissions) {
        const permissionId = permByKey.get(key);
        if (!permissionId) continue;
        desiredIds.push(permissionId);
        await this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId },
          },
          update: {},
          create: { roleId: role.id, permissionId },
        });
      }
      // Revoke stale grants so existing databases converge to the role definitions.
      await this.prisma.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { notIn: desiredIds } },
      });
    }

    // Drop non-canonical roles; their user assignments cascade away.
    const canonical = [ROLES.SUPER_ADMIN, ...Object.keys(ROLE_DEFS)];
    await this.prisma.role.deleteMany({
      where: { name: { notIn: canonical } },
    });
  }

  /** Sets `zone` only on create so reassigned badges aren't clobbered on reboot. */
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

  private async seedDemoData(): Promise<void> {
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

    // Hosts must carry the STAFF role to be selectable.
    const staffRole = await this.prisma.role.findUnique({
      where: { name: ROLES.STAFF },
    });
    if (staffRole) await this.assignRole(hostUser.id, staffRole.id);

    const sarah = await this.prisma.user.upsert({
      where: { id: ID.sarahUser },
      update: {},
      create: {
        id: ID.sarahUser,
        email: 'sarah.lee@aatc.org',
        fullName: 'Sarah Lee',
      },
    });
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

    const visitSeeds: {
      visitorIdx: number;
      status:
        | 'PENDING'
        | 'REVIEW_REQUESTED'
        | 'FLAGGED'
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
      { visitorIdx: 2, status: 'REVIEW_REQUESTED', purpose: 'General Enquiry' },
      { visitorIdx: 3, status: 'DENIED', purpose: 'Client Meeting' },
      { visitorIdx: 0, status: 'CHECKED_IN', purpose: 'Official', today: true },
      { visitorIdx: 1, status: 'CHECKED_OUT', purpose: 'Delivery' },
      { visitorIdx: 3, status: 'FLAGGED', purpose: 'Interview', today: true },
    ];
    for (let i = 0; i < visitSeeds.length; i++) {
      const seed = visitSeeds[i];
      const scheduledAt = seed.today
        ? new Date()
        : new Date('2026-06-12T10:00:00Z');
      const checkInAt = seed.status === 'CHECKED_IN' ? new Date() : null;
      await this.prisma.visit.upsert({
        where: { id: ID.visit(i) },
        // Demo rows are seeder-owned, so refresh them on every boot.
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

    const alertSeeds: {
      idx: number;
      visitIdx: number;
      visitorIdx: number;
      type: 'SECURITY_REVIEW' | 'ADDITIONAL_INFO' | 'RESTRICTED_MATCH';
      level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      reason: string;
      category: string;
    }[] = [
      {
        idx: 0,
        visitIdx: 6,
        visitorIdx: 3,
        type: 'SECURITY_REVIEW',
        level: 'HIGH',
        reason:
          'Guest profile matches a restricted record and requires Security Manager review before check-in.',
        category: 'Restricted Guest',
      },
      {
        idx: 1,
        visitIdx: 2,
        visitorIdx: 2,
        type: 'ADDITIONAL_INFO',
        level: 'MEDIUM',
        reason:
          'Please confirm the visitor’s government-issued ID before this request can be approved.',
        category: 'Identity Verification',
      },
    ];
    for (const a of alertSeeds) {
      const fields = {
        visitId: ID.visit(a.visitIdx),
        visitorId: visitors[a.visitorIdx].id,
        type: a.type,
        level: a.level,
        status: 'OPEN' as const,
        reason: a.reason,
        category: a.category,
        raisedById: hostUser.id,
      };
      await this.prisma.alert.upsert({
        where: { id: ID.alert(a.idx) },
        update: fields,
        create: { id: ID.alert(a.idx), ...fields },
      });
    }

    const noteSeeds: { visitIdx: number; body: string }[] = [
      {
        visitIdx: 0,
        body: 'Visitor details were provided by Dr Alabi via email.',
      },
      { visitIdx: 0, body: 'Awaiting SM confirmation before issuing a pass.' },
      {
        visitIdx: 6,
        body: 'Acknowledged — holding the guest at reception pending Security Manager review.',
      },
      {
        visitIdx: 2,
        body: 'Requested the government ID from the guest; will upload shortly.',
      },
    ];
    for (let i = 0; i < noteSeeds.length; i++) {
      await this.prisma.note.upsert({
        where: { id: ID.note(i) },
        update: {},
        create: {
          id: ID.note(i),
          visitId: ID.visit(noteSeeds[i].visitIdx),
          authorId: hostUser.id,
          authorName: hostUser.fullName,
          body: noteSeeds[i].body,
        },
      });
    }

    // Demo data bypasses the outbox, so the AuditListener never writes these rows.
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
      { action: 'visit.flagged', entityType: 'Visit', entityId: ID.visit(6) },
      {
        action: 'visit.review_requested',
        entityType: 'Visit',
        entityId: ID.visit(2),
      },
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

  private async assignRole(userId: string, roleId: string): Promise<void> {
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  }
}
