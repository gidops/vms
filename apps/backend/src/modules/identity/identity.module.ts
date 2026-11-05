import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PasswordService } from '../../shared/auth/password.service';
import { PasswordResetService } from './password-reset.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // NotificationsModule delivers the password-reset email.
  imports: [PrismaModule, NotificationsModule],
  controllers: [UsersController],
  // PasswordService is a stateless argon2 wrapper; provided here (and in
  // AuthModule) so user creation can hash without a cross-module dependency.
  providers: [UsersService, PasswordService, PasswordResetService],
  exports: [UsersService],
})
export class IdentityModule {}
