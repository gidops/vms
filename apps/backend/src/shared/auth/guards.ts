import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { SecurityAuditService } from '../audit/security-audit.service';
import { EVENT_TYPES } from '../events/domain-event';
import {
  ANY_PERMISSIONS_KEY,
  AuthUser,
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
} from './auth.decorators';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly security: SecurityAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, targets) ??
      [];
    const anyOf =
      this.reflector.getAllAndOverride<string[]>(
        ANY_PERMISSIONS_KEY,
        targets,
      ) ?? [];
    if (required.length === 0 && anyOf.length === 0) return true;

    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
      method?: string;
      url?: string;
    }>();
    const granted = request.user?.permissions ?? [];
    const ok =
      required.every((permission) => granted.includes(permission)) &&
      (anyOf.length === 0 ||
        anyOf.some((permission) => granted.includes(permission)));
    if (!ok) {
      await this.security.record({
        action: EVENT_TYPES.PermissionDenied,
        entityType: 'Authorization',
        actorUserId: request.user?.userId,
        level: 'Warning',
        metadata: {
          required,
          ...(anyOf.length ? { anyOf } : {}),
          granted,
          method: request.method,
          path: request.url,
        },
      });
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
