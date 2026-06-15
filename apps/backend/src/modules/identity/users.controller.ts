import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CreateUserInput,
  PaginationQuery,
  PERMISSIONS,
  UpdateUserRolesInput,
} from '@vms/contracts';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../shared/auth/auth.decorators';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Current principal — roles (all) + the active role's scoped permissions. */
  @Get('users/me')
  async me(@CurrentUser() principal: AuthUser) {
    const user = await this.users.findByIdWithAccess(principal.userId);
    if (!user) throw new NotFoundException('User not found');
    const activeRole = principal.activeRole ?? this.users.defaultRole(user);
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

  @Get('users')
  @RequirePermissions(PERMISSIONS.USER_READ)
  list(@Query(new ZodValidationPipe(PaginationQuery)) query: PaginationQuery) {
    return this.users.list(query);
  }

  @Post('users')
  @RequirePermissions(PERMISSIONS.USER_CREATE)
  async create(
    @Body(new ZodValidationPipe(CreateUserInput)) input: CreateUserInput,
    @CurrentUser() principal: AuthUser,
  ) {
    const user = await this.users.create(input, principal.userId);
    return { id: user.id, email: user.email, roles: user.roles };
  }

  @Patch('users/:id/roles')
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  async updateRoles(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUserRolesInput))
    input: UpdateUserRolesInput,
    @CurrentUser() principal: AuthUser,
  ) {
    const user = await this.users.updateRoles(
      id,
      input.roles,
      principal.userId,
    );
    return { id: user.id, email: user.email, roles: user.roles };
  }

  @Get('roles')
  @RequirePermissions(PERMISSIONS.ROLE_READ)
  listRoles() {
    return this.users.listRoleNames();
  }
}
