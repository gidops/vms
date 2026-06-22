import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ROLES, type SignupInput } from '@vms/contracts';
import {
  UsersService,
  type UserWithAccess,
} from '../../modules/identity/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityAuditService } from '../audit/security-audit.service';
import { EVENT_TYPES } from '../events/domain-event';
import { EventPublisher } from '../events/event-publisher';
import { TransactionManager } from '../events/transaction.manager';
import { LocalAuthProvider } from './local-auth.provider';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh.service';
import { type AccessTokenClaims, TokenService } from './token.service';

export interface LoginContext {
  ip?: string;
  userAgent?: string;
}

interface AuthUserPayload {
  id: string;
  email: string;
  fullName: string;
  preferredLocale: string;
  roles: string[];
  activeRole: string | null;
  permissions: string[];
}

export interface AuthResult {
  user: AuthUserPayload;
  tokens: { accessToken: string; expiresIn: number; tokenType: 'Bearer' };
  refreshToken: string;
}

export interface SwitchRoleResult {
  user: AuthUserPayload;
  tokens: { accessToken: string; expiresIn: number; tokenType: 'Bearer' };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly local: LocalAuthProvider,
    private readonly tokens: TokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
    private readonly security: SecurityAuditService,
  ) {}

  async login(
    input: { email: string; password: string },
    ctx: LoginContext,
  ): Promise<AuthResult> {
    let user: UserWithAccess;
    try {
      user = await this.local.authenticate(input);
    } catch (err) {
      // Failed credentials leave no business transaction — audit directly so
      // brute-force / credential-stuffing attempts are visible in the trail.
      await this.security.record({
        action: EVENT_TYPES.LoginFailed,
        entityType: 'User',
        level: 'Warning',
        metadata: { email: input.email },
      });
      throw err;
    }
    return this.startSession(user, ctx);
  }

  /** Open signup — creates a SUPER_ADMIN and logs in. */
  async signup(input: SignupInput, ctx: LoginContext): Promise<AuthResult> {
    const user = await this.users.create({
      email: input.email,
      fullName: input.fullName,
      password: input.password,
      roles: [ROLES.SUPER_ADMIN],
    });
    return this.startSession(user, ctx);
  }

  /** Signup is always available (the first-run lock is intentionally disabled). */
  signupAvailable(): Promise<boolean> {
    return Promise.resolve(true);
  }

  async refresh(rawToken: string): Promise<AuthResult> {
    const { userId, token, sessionId, activeRole } =
      await this.refreshTokens.rotate(rawToken);
    const user = await this.users.findByIdWithAccess(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    // Preserve the session's active role; fall back if it was removed.
    const effectiveRole =
      activeRole && user.roles.includes(activeRole)
        ? activeRole
        : this.users.defaultRole(user);
    const accessToken = await this.tokens.signAccessToken(
      this.claims(user, effectiveRole, sessionId),
    );
    await this.security.record({
      action: EVENT_TYPES.TokenRefreshed,
      entityType: 'Session',
      entityId: sessionId,
      actorUserId: userId,
      level: 'Information',
    });
    return this.result(user, accessToken, token, effectiveRole);
  }

  async logout(rawToken: string): Promise<void> {
    const userId = await this.refreshTokens.revoke(rawToken);
    await this.security.record({
      action: EVENT_TYPES.Logout,
      entityType: 'Session',
      actorUserId: userId ?? undefined,
      level: 'Information',
    });
  }

  /** Change password after verifying the current one; revokes all sessions. */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Password change not available');
    }
    const valid = await this.passwords.verify(
      user.passwordHash,
      currentPassword,
    );
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const passwordHash = await this.passwords.hash(newPassword);
    await this.txm.run(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await this.events.publish(tx, {
        type: EVENT_TYPES.UserPasswordChanged,
        aggregateType: 'User',
        aggregateId: userId,
        payload: {},
        metadata: { actorUserId: userId },
      });
    });
    // Force re-auth everywhere (matches the "logs you out of all sessions" copy).
    await this.refreshTokens.revokeAllForUser(userId);
  }

  /** Switch the active role for the current session and re-mint the token. */
  async switchRole(
    userId: string,
    sessionId: string | undefined,
    role: string,
  ): Promise<SwitchRoleResult> {
    const user = await this.users.findByIdWithAccess(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Not authenticated');
    }
    if (!user.roles.includes(role)) {
      throw new ForbiddenException('You do not have that role');
    }
    if (sessionId) {
      await this.refreshTokens.setSessionActiveRole(sessionId, role);
    }
    const accessToken = await this.tokens.signAccessToken(
      this.claims(user, role, sessionId),
    );
    await this.security.record({
      action: EVENT_TYPES.RoleSwitched,
      entityType: 'User',
      entityId: userId,
      actorUserId: userId,
      level: 'Information',
      metadata: { role, sessionId },
    });
    return {
      user: this.userPayload(user, role),
      tokens: {
        accessToken,
        expiresIn: this.tokens.accessTokenTtlSeconds(),
        tokenType: 'Bearer',
      },
    };
  }

  /** Create the session, refresh token + login event, then mint a scoped token. */
  private async startSession(
    user: UserWithAccess,
    ctx: LoginContext,
  ): Promise<AuthResult> {
    const activeRole = this.users.defaultRole(user);
    const { token, sessionId } = await this.txm.run(async (tx) => {
      const issued = await this.refreshTokens.issueForNewSession(tx, user.id, {
        ...ctx,
        activeRole,
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.UserLoggedIn,
        aggregateType: 'User',
        aggregateId: user.id,
        payload: { email: user.email },
        metadata: { actorUserId: user.id },
      });
      return issued;
    });

    const accessToken = await this.tokens.signAccessToken(
      this.claims(user, activeRole, sessionId),
    );
    return this.result(user, accessToken, token, activeRole);
  }

  private claims(
    user: UserWithAccess,
    activeRole: string | null,
    sid: string | undefined,
  ): AccessTokenClaims {
    return {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      activeRole,
      permissions: this.users.permissionsForRole(user, activeRole),
      sid,
      tenantId: user.tenantId,
      preferredLocale: user.preferredLocale,
    };
  }

  private userPayload(
    user: UserWithAccess,
    activeRole: string | null,
  ): AuthUserPayload {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      preferredLocale: user.preferredLocale,
      roles: user.roles,
      activeRole,
      permissions: this.users.permissionsForRole(user, activeRole),
    };
  }

  private result(
    user: UserWithAccess,
    accessToken: string,
    refreshToken: string,
    activeRole: string | null,
  ): AuthResult {
    return {
      user: this.userPayload(user, activeRole),
      tokens: {
        accessToken,
        expiresIn: this.tokens.accessTokenTtlSeconds(),
        tokenType: 'Bearer',
      },
      refreshToken,
    };
  }
}
