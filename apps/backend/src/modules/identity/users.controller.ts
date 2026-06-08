import { Controller, Get, NotFoundException } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../shared/auth/auth.decorators';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() principal: AuthUser) {
    const user = await this.users.findByIdWithAccess(principal.userId);
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      preferredLocale: user.preferredLocale,
      roles: user.roles,
      permissions: user.permissions,
    };
  }
}
