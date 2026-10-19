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

/**
 * The visitor's self-registration from the desk QR. No login: the printed
 * token is checked on every call, and every route is rate-limited per phone
 * (IP) and per QR.
 */
@Public()
@UseGuards(RateLimitGuard)
@Controller('public/desk-qr/:token')
export class PublicRegistrationController {
  constructor(private readonly registrations: PublicRegistrationService) {}

  /** Scanned: start the 10-minute form. */
  @Get()
  @RateLimit(
    { name: 'open-ip', limit: 30, windowMs: MINUTE, by: 'ip' },
    { name: 'open-qr', limit: 300, windowMs: MINUTE, by: { param: 'token' } },
  )
  open(@Param('token') token: string): Promise<DeskQrFormSession> {
    return this.registrations.open(token);
  }

  /** The "who are you visiting" search: names and departments only. */
  @Get('hosts')
  @RateLimit({ name: 'hosts-ip', limit: 60, windowMs: MINUTE, by: 'ip' })
  hosts(
    @Param('token') token: string,
    @Query(new ZodValidationPipe(PublicHostSearchQuery))
    query: PublicHostSearchQuery,
  ): Promise<PublicHostOption[]> {
    return this.registrations.searchHosts(token, query.q);
  }

  /** Submit the form; a code is emailed to the desk. */
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

  /** Enter the code reception read out; creates today's walk-in. */
  @Post('registrations/:id/verify')
  @HttpCode(200)
  @RateLimit({ name: 'verify-ip', limit: 10, windowMs: MINUTE, by: 'ip' })
  verify(
    @Param('token') token: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(VerifyRegistrationInput))
    input: VerifyRegistrationInput,
  ): Promise<PublicRegistrationResult> {
    return this.registrations.verify(token, id, input.code);
  }
}
