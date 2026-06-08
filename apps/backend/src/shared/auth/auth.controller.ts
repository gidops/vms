import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { LoginInput } from '@vms/contracts';
import type { Request } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Public } from './auth.decorators';
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
