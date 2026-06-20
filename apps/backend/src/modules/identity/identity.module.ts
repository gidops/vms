import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PasswordService } from '../../shared/auth/password.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  // PasswordService is a stateless argon2 wrapper; provided here (and in
  // AuthModule) so user creation can hash without a cross-module dependency.
  providers: [UsersService, PasswordService],
  exports: [UsersService],
})
export class IdentityModule {}
