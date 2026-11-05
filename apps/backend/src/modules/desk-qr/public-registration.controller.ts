import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  DESK_QR_TOKEN_RE,
  PublicHostSearchQuery,
  PublicRegistrationInput,
  type DeskQrFormSession,
  type PublicHostOption,
  type PublicRegistrationResult,
} from '@vms/contracts';
import { Public } from '../../shared/auth/auth.decorators';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import {
  RateLimit,
  RateLimitGuard,
} from '../../shared/rate-limit/rate-limit.guard';
import { PublicRegistrationService } from './public-registration.service';

const MINUTE = 60_000;
const BY_TOKEN = { param: 'token', pattern: DESK_QR_TOKEN_RE };

/** No login: the printed token is checked on every call, and every route is rate-limited per IP and per QR. */
@Public()
@UseGuards(RateLimitGuard)
@Controller('public/desk-qr/:token')
export class PublicRegistrationController {
  constructor(private readonly registrations: PublicRegistrationService) {}

  @Get()
  @RateLimit(
    { name: 'open-ip', limit: 30, windowMs: MINUTE, by: 'ip' },
    { name: 'open-qr', limit: 300, windowMs: MINUTE, by: BY_TOKEN },
  )
  open(@Param('token') token: string): Promise<DeskQrFormSession> {
    return this.registrations.open(token);
  }

  @Get('hosts')
  @RateLimit(
    { name: 'hosts-ip', limit: 60, windowMs: MINUTE, by: 'ip' },
    { name: 'hosts-qr', limit: 300, windowMs: MINUTE, by: BY_TOKEN },
  )
  hosts(
    @Param('token') token: string,
    @Query(new ZodValidationPipe(PublicHostSearchQuery))
    query: PublicHostSearchQuery,
  ): Promise<PublicHostOption[]> {
    return this.registrations.searchHosts(token, query.q, query.formToken);
  }

  @Post('registrations')
  @RateLimit(
    { name: 'submit-ip', limit: 10, windowMs: MINUTE, by: 'ip' },
    { name: 'submit-qr', limit: 60, windowMs: MINUTE, by: BY_TOKEN },
  )
  submit(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(PublicRegistrationInput))
    input: PublicRegistrationInput,
  ): Promise<PublicRegistrationResult> {
    return this.registrations.submit(token, input);
  }
}
