import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../config/env.schema';
import type { AuthUser } from './auth.decorators';
import type { AccessTokenClaims } from './token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  // Returned value is attached as request.user. Roles/permissions ride in the
  // token, so authorization needs no per-request DB lookup.
  validate(payload: AccessTokenClaims): AuthUser {
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles ?? [],
      // Legacy tokens (pre-RBAC-switch) default the active role to the first.
      activeRole: payload.activeRole ?? payload.roles?.[0] ?? null,
      permissions: payload.permissions ?? [],
      sid: payload.sid,
      tenantId: payload.tenantId ?? null,
    };
  }
}
