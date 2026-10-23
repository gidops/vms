import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ROLES } from '@vms/contracts';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { UsersService } from './../src/modules/identity/users.service';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * End-to-end auth + audit trail. Boots the real app (global JWT/permission
 * guards) against a live database and asserts that security-relevant events
 * land in `AuditLog`. Self-contained and seed/DB-state independent: on an
 * empty database it bootstraps its account through /auth/signup (exercising
 * the first-run path); on a populated database — where signup is locked — it
 * provisions the account directly via UsersService. Requires DATABASE_URL +
 * JWT_SECRET and a migrated database (see CI / runbook).
 */
describe('Auth + audit trail (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Unique per run so repeated runs against a persistent DB don't collide.
  const email = `e2e-${Date.now()}@test.local`;
  const password = 'Passw0rd!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();

    if ((await prisma.user.count()) === 0) {
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email, fullName: 'E2E Tester', password })
        .expect(201);
    } else {
      await app.get(UsersService).create({
        email,
        fullName: 'E2E Tester',
        password,
        roles: [ROLES.SUPER_ADMIN],
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses signup once a user exists, and records auth.signup_blocked', async () => {
    // beforeAll guarantees at least one user, so the bootstrap must be locked.
    await request(app.getHttpServer())
      .get('/auth/signup-available')
      .expect(200)
      .expect({ available: false });

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'intruder@test.local',
        fullName: 'Intruder',
        password: 'Passw0rd!',
      })
      .expect(403);

    const row = await prisma.auditLog.findFirst({
      where: { action: 'auth.signup_blocked' },
      orderBy: { createdAt: 'desc' },
    });
    expect(row).not.toBeNull();
    expect((row?.metadata as { email?: string })?.email).toBe(
      'intruder@test.local',
    );
  });

  it('rejects bad credentials and records auth.login_failed', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);

    const row = await prisma.auditLog.findFirst({
      where: { action: 'auth.login_failed' },
      orderBy: { createdAt: 'desc' },
    });
    expect(row).not.toBeNull();
    expect((row?.metadata as { email?: string })?.email).toBe(email);
  });

  it('logs in and can reach a protected route with the access token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(res.body.tokens?.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${res.body.tokens.accessToken}`)
      .expect(200);
  });

  it('rejects an unauthenticated request to a protected route', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('rotates a refresh token and flags reuse of the old one', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const original = login.body.refreshToken as string;

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: original })
      .expect(200);

    // Replaying the now-used token must fail and raise a security event.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: original })
      .expect(401);

    const reuse = await prisma.auditLog.findFirst({
      where: { action: 'auth.refresh_reuse_detected' },
      orderBy: { createdAt: 'desc' },
    });
    expect(reuse).not.toBeNull();
    expect(reuse?.eventType).toBe('auth.refresh_reuse_detected');
  });
});
