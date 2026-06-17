import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { IdentityModule } from '../../modules/identity/identity.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard, PermissionsGuard } from './guards';
import { JwtStrategy } from './jwt.strategy';
import { LocalAuthProvider } from './local-auth.provider';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh.service';
import { SeederService } from './seeder.service';
import { TokenService } from './token.service';

@Module({
  imports: [
    PrismaModule,
    IdentityModule,
    AuditModule,
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalAuthProvider,
    PasswordService,
    TokenService,
    RefreshTokenService,
    JwtStrategy,
    SeederService,
    // Global auth (with @Public opt-out) then global permission enforcement.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AuthModule {}
