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
import { AuthUser, IS_PUBLIC_KEY, PERMISSIONS_KEY } from './auth.decorators';

/** Global authentication guard; routes opt out with @Public(). */
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

/** Global authorization guard; enforces @RequirePermissions(...). */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly security: SecurityAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
      method?: string;
      url?: string;
    }>();
    const granted = request.user?.permissions ?? [];
    const ok = required.every((permission) => granted.includes(permission));
    if (!ok) {
      // Record the denial so attempts to exceed privilege are auditable.
      await this.security.record({
        action: EVENT_TYPES.PermissionDenied,
        entityType: 'Authorization',
        actorUserId: request.user?.userId,
        level: 'Warning',
        metadata: {
          required,
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
