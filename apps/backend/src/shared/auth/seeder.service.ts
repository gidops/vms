import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ACCESS_CARD_ZONES, PERMISSIONS, ROLES } from '@vms/contracts';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Scoped roles (SUPER_ADMIN gets every permission and is handled separately).
 * VMC is reception only — it registers visitors, checks them in/out and works the
 * Requests & Alerts notification feed, but does NOT approve or deny requests;
 * approval is an Admin responsibility.
 */
const ROLE_DEFS: Record<
  string,
  { description: string; permissions: string[] }
> = {
  [ROLES.ADMIN]: {
    description:
      'Administrator (Security Manager) — manage users and roles, decide/flag visit requests',
    permissions: [
      PERMISSIONS.USER_READ,
      PERMISSIONS.USER_CREATE,
      PERMISSIONS.USER_UPDATE,
      PERMISSIONS.USER_DELETE,
      PERMISSIONS.ROLE_READ,
      PERMISSIONS.VISIT_APPROVE,
      PERMISSIONS.VISIT_DENY,
      // The Security Manager raises and resolves security alerts (flag / request more info);
      // staff/VMC only respond via notes and cannot resolve.
      PERMISSIONS.VISIT_FLAG,
      PERMISSIONS.VISIT_REQUEST_INFO,
      PERMISSIONS.ALERT_RESOLVE,
      PERMISSIONS.ALERT_ESCALATE,
      PERMISSIONS.NOTE_ADD,
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
    description: 'VMC Reception — registers visitors and checks them in/out',
    permissions: [
      PERMISSIONS.VISITOR_REGISTER,
      PERMISSIONS.INVITATION_CREATE,
      PERMISSIONS.VISIT_CANCEL,
      PERMISSIONS.VISIT_EDIT,
      // VMC does not approve/deny requests — that is an Admin responsibility.
      // Check-in/out now happen at the VMC station (badge assigned/released here).
      PERMISSIONS.VISIT_CHECK_IN,
      PERMISSIONS.VISIT_CHECK_OUT,
      // VMC responds to security alerts via notes only — it cannot resolve them
      // (that is the Security Manager/admin's call, and it unblocks check-in).
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
  alert: (n: number) => `00000000-0000-4000-8000-0000000000${40 + n}`,
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
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Roles + permissions are reference data — seeded in EVERY environment so
    // the first-run /signup can assign SUPER_ADMIN. The admin USER is never
    // seeded; the first one is created through /signup.
    await this.seedRbac();
    await this.seedAccessCards();
    // Demo requests/alerts are opt-in via SEED_DEMO_DATA (default off) so they can
    // be controlled per-environment, including production.
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
      // Revoke any permission no longer in the role definition (e.g. approve/deny
      // removed from VMC) so existing databases converge to the current taxonomy.
      await this.prisma.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { notIn: desiredIds } },
      });
    }

    // Drop legacy roles no longer in the canonical taxonomy (e.g. a deprecated
    // RECEPTION role) — their user assignments cascade away.
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

    // A spread of statuses (all hosted by Dr Alabi) so the staff dashboard's
    // stats, My Visits filters and the lifecycle stepper all have data. `today`
    // schedules the visit for now so "Expected Today" / date filters are non-empty.
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
      // A flagged visit (idx 6) — carries an open SECURITY_REVIEW alert below so
      // the flagged flow (stripe + Alert Summary + check-in hold) is demoable.
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

    // Security alerts, each tied to a visit (every alert is about a visit). The
    // flagged visit (idx 6) gets an open SECURITY_REVIEW that holds check-in; the
    // review-requested visit (idx 2) gets an open ADDITIONAL_INFO request.
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
      // Demo rows are seeder-owned: refresh on every boot (like the visit seeds)
      // so shape changes take effect and the flagged flow stays consistent.
      await this.prisma.alert.upsert({
        where: { id: ID.alert(a.idx) },
        update: fields,
        create: { id: ID.alert(a.idx), ...fields },
      });
    }

    // Notes on the pending request plus responses on the flagged / review-requested
    // visits, so the Alert Summary threads aren't empty in dev.
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

  /** Idempotently grant a role to a user (composite-key upsert). */
  private async assignRole(userId: string, roleId: string): Promise<void> {
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  }
}
