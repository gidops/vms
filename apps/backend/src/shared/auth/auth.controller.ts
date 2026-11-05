import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ChangePasswordInput,
  CompletePasswordResetInput,
  LoginInput,
  RefreshInput,
  SignupInput,
  SwitchRoleInput,
  ValidateResetTokenInput,
} from '@vms/contracts';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RateLimit, RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { CurrentUser, Public, type AuthUser } from './auth.decorators';
import { AuthService } from './auth.service';

const MINUTE = 60_000;

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(LoginInput))
    body: { email: string; password: string },
    @Req() req: Request,
  ) {
    return this.auth.login(body, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('signup')
  @HttpCode(201)
  signup(
    @Body(new ZodValidationPipe(SignupInput)) body: SignupInput,
    @Req() req: Request,
  ) {
    return this.auth.signup(body, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Get('signup-available')
  async signupAvailable() {
    return { available: await this.auth.signupAvailable() };
  }

  @Post('switch-role')
  @HttpCode(200)
  switchRole(
    @Body(new ZodValidationPipe(SwitchRoleInput)) body: SwitchRoleInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.auth.switchRole(principal.userId, principal.sid, body.role);
  }

  @Post('change-password')
  @HttpCode(204)
  async changePassword(
    @Body(new ZodValidationPipe(ChangePasswordInput)) body: ChangePasswordInput,
    @CurrentUser() principal: AuthUser,
  ) {
    await this.auth.changePassword(
      principal.userId,
      body.currentPassword,
      body.newPassword,
    );
  }

  /** Lets the reset page distinguish a live link from an expired one. */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'reset-validate', limit: 30, windowMs: MINUTE, by: 'ip' })
  @Post('reset-password/validate')
  @HttpCode(200)
  async validateResetToken(
    @Body(new ZodValidationPipe(ValidateResetTokenInput))
    body: ValidateResetTokenInput,
  ) {
    return { valid: await this.auth.validateResetToken(body.token) };
  }

  /** Completes an admin-issued reset; rate-limited because the token is the only credential. */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({
    name: 'reset-complete',
    limit: 10,
    windowMs: 15 * MINUTE,
    by: 'ip',
  })
  @Post('reset-password')
  @HttpCode(204)
  async resetPassword(
    @Body(new ZodValidationPipe(CompletePasswordResetInput))
    body: CompletePasswordResetInput,
  ) {
    await this.auth.completePasswordReset(body.token, body.newPassword);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(RefreshInput)) body: RefreshInput) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body(new ZodValidationPipe(RefreshInput)) body: RefreshInput) {
    await this.auth.logout(body.refreshToken);
  }
}
