import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { AuditLog } from '@prisma/client';
import { ADDON_ROLES, ROLES } from '@vms/contracts';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { UsersService } from '../../src/modules/identity/users.service';
import { PrismaService } from '../../src/prisma/prisma.service';

const PASSWORD = 'Passw0rd!';
const ROLE_NAMES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.VMC_ADMIN,
  ROLES.READ_ADMIN,
  ROLES.VMC,
  ROLES.STAFF,
];

export interface RoleApp {
  app: INestApplication<App>;
  prisma: PrismaService;
  /** Unique per run, used to keep test emails and dates distinct. */
  run: number;
  tokens: Record<string, string>;
  userIds: Record<string, string>;
  as: (role: string) => {
    get: (url: string) => request.Test;
    post: (url: string) => request.Test;
  };
  guest: (
    email: string,
    over?: Record<string, unknown>,
  ) => Record<string, unknown>;
  walkIn: (
    email: string,
    over?: Record<string, unknown>,
  ) => Promise<{ id: string }>;
  waitForAudit: (
    action: string,
    match: (metadata: Record<string, unknown>) => boolean,
  ) => Promise<AuditLog | null>;
}

/**
 * Boots the full app against the test database and signs in one user per role
 * (add-on roles also hold their base role). Call at the top of a describe block.
 */
export function useRoleApp(prefix: string): RoleApp {
  const ctx = {
    run: Date.now(),
    tokens: {},
    userIds: {},
  } as RoleApp;

  ctx.as = (role) => ({
    get: (url) =>
      request(ctx.app.getHttpServer())
        .get(url)
        .set('Authorization', `Bearer ${ctx.tokens[role]}`),
    post: (url) =>
      request(ctx.app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${ctx.tokens[role]}`),
  });

  ctx.guest = (email, over = {}) => ({
    fullName: `Guest ${email}`,
    email,
    organization: 'Org',
    floor: '4th Floor',
    purpose: 'Official',
    needsEvacuationAssist: false,
    commsConsent: false,
    ...over,
  });

  ctx.walkIn = async (email, over = {}) => {
    const res = await ctx
      .as(ROLES.VMC)
      .post('/visits')
      .send({ type: 'WALK_IN', guests: [ctx.guest(email, over)] })
      .expect(201);
    return res.body[0] as { id: string };
  };

  // Audit rows arrive through the outbox relay after the response, so poll.
  ctx.waitForAudit = async (action, match) => {
    const deadline = Date.now() + 15_000;
    for (;;) {
      const rows = await ctx.prisma.auditLog.findMany({
        where: { action },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      const hit = rows.find((r) =>
        match((r.metadata ?? {}) as Record<string, unknown>),
      );
      if (hit || Date.now() > deadline) return hit ?? null;
      await new Promise((r) => setTimeout(r, 250));
    }
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    ctx.app = moduleFixture.createNestApplication();
    ctx.prisma = ctx.app.get(PrismaService);
    await ctx.app.init();

    const users = ctx.app.get(UsersService);
    for (const role of ROLE_NAMES) {
      const email = `${prefix}-${role.toLowerCase()}-${ctx.run}@test.local`;
      const u = await users.create({
        email,
        fullName: `${prefix} ${role}`,
        password: PASSWORD,
        roles: ADDON_ROLES[role] ? [ADDON_ROLES[role], role] : [role],
      });
      ctx.userIds[role] = u.id;
      const login = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      ctx.tokens[role] = login.body.tokens.accessToken as string;
    }
    // App boot plus seven argon2 sign-ups is slow on small CI runners.
  }, 120_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  return ctx;
}
