import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Opt a route out of the global JWT guard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSIONS_KEY = 'requiredPermissions';
/** Require all listed permission keys (checked by PermissionsGuard). */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** The authenticated principal attached by the JWT strategy. */
export interface AuthUser {
  userId: string;
  email: string;
  /** All role names the user holds. */
  roles: string[];
  /** The active role scoping this session (may be null on legacy tokens). */
  activeRole?: string | null;
  /** Permissions of the active role only. */
  permissions: string[];
  /** Session id from the token (for switch-role). */
  sid?: string;
  tenantId?: string | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    return request.user;
  },
);
