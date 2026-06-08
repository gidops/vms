import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  UsersService,
  type UserWithAccess,
} from '../../modules/identity/users.service';
import { EVENT_TYPES } from '../events/domain-event';
import { EventPublisher } from '../events/event-publisher';
import { TransactionManager } from '../events/transaction.manager';
import { LocalAuthProvider } from './local-auth.provider';
import { RefreshTokenService } from './refresh.service';
import { type AccessTokenClaims, TokenService } from './token.service';

export interface LoginContext {
  ip?: string;
  userAgent?: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    fullName: string;
    preferredLocale: string;
    roles: string[];
  };
  tokens: { accessToken: string; expiresIn: number; tokenType: 'Bearer' };
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly local: LocalAuthProvider,
    private readonly tokens: TokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly users: UsersService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
  ) {}

  async login(
    input: { email: string; password: string },
    ctx: LoginContext,
  ): Promise<AuthResult> {
    const user = await this.local.authenticate(input);

    // State change (session + refresh token) and the UserLoggedIn event are
    // written in one transaction via the outbox.
    const refreshToken = await this.txm.run(async (tx) => {
      const token = await this.refreshTokens.issueForNewSession(
        tx,
        user.id,
        ctx,
      );
      await this.events.publish(tx, {
        type: EVENT_TYPES.UserLoggedIn,
        aggregateType: 'User',
        aggregateId: user.id,
        payload: { email: user.email },
        metadata: { actorUserId: user.id },
      });
      return token;
    });

    const accessToken = await this.tokens.signAccessToken(this.claims(user));
    return this.result(user, accessToken, refreshToken);
  }

  async refresh(rawToken: string): Promise<AuthResult> {
    const { userId, token } = await this.refreshTokens.rotate(rawToken);
    const user = await this.users.findByIdWithAccess(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const accessToken = await this.tokens.signAccessToken(this.claims(user));
    return this.result(user, accessToken, token);
  }

  async logout(rawToken: string): Promise<void> {
    await this.refreshTokens.revoke(rawToken);
  }

  private claims(user: UserWithAccess): AccessTokenClaims {
    return {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      tenantId: user.tenantId,
    };
  }

  private result(
    user: UserWithAccess,
    accessToken: string,
    refreshToken: string,
  ): AuthResult {
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        preferredLocale: user.preferredLocale,
        roles: user.roles,
      },
      tokens: {
        accessToken,
        expiresIn: this.tokens.accessTokenTtlSeconds(),
        tokenType: 'Bearer',
      },
      refreshToken,
    };
  }
}
