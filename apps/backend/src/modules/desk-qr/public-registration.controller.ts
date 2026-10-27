import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  PublicHostSearchQuery,
  PublicRegistrationInput,
  VerifyRegistrationInput,
  type DeskQrFormSession,
  type PublicHostOption,
  type PublicRegistrationPending,
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

/** No login: the printed token is checked on every call, and every route is rate-limited per IP and per QR. */
@Public()
@UseGuards(RateLimitGuard)
@Controller('public/desk-qr/:token')
export class PublicRegistrationController {
  constructor(private readonly registrations: PublicRegistrationService) {}

  @Get()
  @RateLimit(
    { name: 'open-ip', limit: 30, windowMs: MINUTE, by: 'ip' },
    { name: 'open-qr', limit: 300, windowMs: MINUTE, by: { param: 'token' } },
  )
  open(@Param('token') token: string): Promise<DeskQrFormSession> {
    return this.registrations.open(token);
  }

  @Get('hosts')
  @RateLimit({ name: 'hosts-ip', limit: 60, windowMs: MINUTE, by: 'ip' })
  hosts(
    @Param('token') token: string,
    @Query(new ZodValidationPipe(PublicHostSearchQuery))
    query: PublicHostSearchQuery,
  ): Promise<PublicHostOption[]> {
    return this.registrations.searchHosts(token, query.q);
  }

  @Post('registrations')
  @RateLimit(
    { name: 'submit-ip', limit: 10, windowMs: MINUTE, by: 'ip' },
    { name: 'submit-qr', limit: 60, windowMs: MINUTE, by: { param: 'token' } },
  )
  submit(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(PublicRegistrationInput))
    input: PublicRegistrationInput,
  ): Promise<PublicRegistrationPending> {
    return this.registrations.submit(token, input);
  }

  @Post('registrations/:id/verify')
  @HttpCode(200)
  @RateLimit(
    { name: 'verify-ip', limit: 10, windowMs: MINUTE, by: 'ip' },
    // Per QR too: behind a proxy or with spoofed addresses, per-IP limits alone do not bound guesses.
    { name: 'verify-qr', limit: 60, windowMs: MINUTE, by: { param: 'token' } },
  )
  verify(
    @Param('token') token: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(VerifyRegistrationInput))
    input: VerifyRegistrationInput,
  ): Promise<PublicRegistrationResult> {
    return this.registrations.verify(token, id, input.code);
  }
}
