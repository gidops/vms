import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  GATE_KIOSK_TOKEN_RE,
  GateVerifyInput,
  type GateVerifyResult,
} from '@vms/contracts';
import { Public } from '../../shared/auth/auth.decorators';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import {
  RateLimit,
  RateLimitGuard,
} from '../../shared/rate-limit/rate-limit.guard';
import { GateKioskService } from './gate-kiosk.service';
import { GateService } from './gate.service';

const MINUTE = 60_000;
const BY_TOKEN = { param: 'token', pattern: GATE_KIOSK_TOKEN_RE };

/**
 * The gate kiosk device: no login. The kiosk link's token is checked on every
 * call (unknown, rotated or disabled → 404), and every route is rate-limited
 * per IP and per link.
 */
@Public()
@UseGuards(RateLimitGuard)
@Controller('public/gate/:token')
export class GateController {
  constructor(
    private readonly kiosks: GateKioskService,
    private readonly gate: GateService,
  ) {}

  /** Lets the kiosk page tell a live link from a dead one before scanning. */
  @Get()
  @RateLimit(
    { name: 'gate-open-ip', limit: 30, windowMs: MINUTE, by: 'ip' },
    { name: 'gate-open-link', limit: 120, windowMs: MINUTE, by: BY_TOKEN },
  )
  async open(@Param('token') token: string): Promise<{ active: true }> {
    await this.kiosks.activeKiosk(token);
    return { active: true };
  }

  /** Scan or typed code → what to tell the visitor. Never changes the visit's status. */
  @Post('verify')
  @HttpCode(200)
  @RateLimit(
    { name: 'gate-verify-ip', limit: 60, windowMs: MINUTE, by: 'ip' },
    { name: 'gate-verify-link', limit: 300, windowMs: MINUTE, by: BY_TOKEN },
  )
  async verify(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(GateVerifyInput)) input: GateVerifyInput,
  ): Promise<GateVerifyResult> {
    const kiosk = await this.kiosks.activeKiosk(token);
    return this.gate.verify(input, kiosk.id);
  }
}
