import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  AdminUpdateUserInput,
  CreateUserInput,
  PERMISSIONS,
  PresignAvatarInput,
  UpdateAvatarInput,
  UpdateMeInput,
  UpdateUserRolesInput,
  UpdateUserStatusInput,
  UserListQuery,
} from '@vms/contracts';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../shared/auth/auth.decorators';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { S3Service } from '../../shared/storage/s3.service';
import { PasswordResetService } from './password-reset.service';
import { UsersService, type UserWithAccess } from './users.service';

@Controller()
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly resets: PasswordResetService,
    private readonly s3: S3Service,
  ) {}

  /** Current principal — roles (all) + the active role's scoped permissions. */
  @Get('users/me')
  async me(@CurrentUser() principal: AuthUser) {
    const user = await this.users.findByIdWithAccess(principal.userId);
    if (!user) throw new NotFoundException('User not found');
    return this.profile(user, principal.activeRole ?? null);
  }

  @Patch('users/me')
  async updateMe(
    @Body(new ZodValidationPipe(UpdateMeInput)) input: UpdateMeInput,
    @CurrentUser() principal: AuthUser,
  ) {
    const user = await this.users.updateMe(principal.userId, input);
    return this.profile(user, principal.activeRole ?? null);
  }

  @Post('users/me/avatar/presign')
  presignAvatar(
    @Body(new ZodValidationPipe(PresignAvatarInput)) input: PresignAvatarInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.s3.presignAvatar(principal.userId, input.contentType);
  }

  @Put('users/me/avatar')
  async setAvatar(
    @Body(new ZodValidationPipe(UpdateAvatarInput)) input: UpdateAvatarInput,
    @CurrentUser() principal: AuthUser,
  ) {
    const user = await this.users.setAvatar(principal.userId, input.avatarKey);
    return this.profile(user, principal.activeRole ?? null);
  }

  @Get('users/me/sessions')
  sessions(@CurrentUser() principal: AuthUser) {
    return this.users.listSessions(principal.userId, principal.sid);
  }

  @Get('users')
  @RequirePermissions(PERMISSIONS.USER_READ)
  list(@Query(new ZodValidationPipe(UserListQuery)) query: UserListQuery) {
    return this.users.list(query);
  }

  // Declared after the users/me routes so 'me' never reaches the :id matcher.
  @Get('users/:id')
  @RequirePermissions(PERMISSIONS.USER_READ)
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.getDetail(id);
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
    @Param('id', ParseUUIDPipe) id: string,
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

  @Patch('users/:id')
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  adminUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdminUpdateUserInput))
    input: AdminUpdateUserInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.users.adminUpdate(id, input, principal.userId);
  }

  @Patch('users/:id/status')
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateUserStatusInput))
    input: UpdateUserStatusInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.users.setStatus(id, input.isActive, principal.userId);
  }

  /** Emails the user a single-use, short-lived set-password link. */
  @Post('users/:id/password-reset')
  @HttpCode(202)
  @RequirePermissions(PERMISSIONS.USER_RESET_PASSWORD)
  requestPasswordReset(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.resets.requestReset(id, principal.userId);
  }

  @Delete('users/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.USER_DELETE)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() principal: AuthUser,
  ) {
    await this.users.deleteUser(id, principal.userId);
  }

  @Get('roles')
  @RequirePermissions(PERMISSIONS.ROLE_READ)
  listRoles() {
    return this.users.listRoleNames();
  }

  /** Staff directory for the host picker; open to every signed-in role that raises invites. */
  @Get('hosts')
  listHosts() {
    return this.users.listHosts();
  }

  /** Build the self-profile payload (roles + active-role-scoped permissions). */
  private profile(user: UserWithAccess, activeRole: string | null) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarKey: user.avatarKey,
      timezone: user.timezone,
      assignedDesk: user.assignedDesk,
      notificationPrefs: user.notificationPrefs,
      preferredLocale: user.preferredLocale,
      roles: user.roles,
      activeRole,
      permissions: this.users.permissionsForRole(user, activeRole),
      hostOffice: user.host?.office ?? null,
      hostDepartment: user.host?.department ?? null,
    };
  }
}
