import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { LoginInput, SignupInput, SwitchRoleInput } from '@vms/contracts';
import type { Request } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser, Public, type AuthUser } from './auth.decorators';
import { AuthService } from './auth.service';

const RefreshBody = z.object({ refreshToken: z.string().min(1) });
type RefreshBody = z.infer<typeof RefreshBody>;

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

  /** First-run only: bootstraps the initial SUPER_ADMIN account. */
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

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(RefreshBody)) body: RefreshBody) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body(new ZodValidationPipe(RefreshBody)) body: RefreshBody) {
    await this.auth.logout(body.refreshToken);
  }
}
