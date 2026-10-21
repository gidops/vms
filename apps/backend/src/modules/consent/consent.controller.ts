import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  OptInListQuery,
  PERMISSIONS,
  WithdrawConsentInput,
} from '@vms/contracts';
import type { Response } from 'express';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../shared/auth/auth.decorators';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { watToday } from '../../shared/common/wat';
import { ConsentService } from './consent.service';

/** Comms Opt-ins: the list, its CSV export, and consent withdrawal. */
@Controller('consent')
export class ConsentController {
  constructor(private readonly consent: ConsentService) {}

  @Get('opt-ins')
  @RequirePermissions(PERMISSIONS.CONSENT_READ)
  list(@Query(new ZodValidationPipe(OptInListQuery)) query: OptInListQuery) {
    return this.consent.list(query);
  }

  @Get('opt-ins.csv')
  @RequirePermissions(PERMISSIONS.CONSENT_READ, PERMISSIONS.CONSENT_EXPORT)
  async exportCsv(
    @CurrentUser() principal: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.consent.exportCsv(principal.userId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="aatc-comms-opt-ins_${watToday()}.csv"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  }

  @Post('withdraw')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.CONSENT_MANAGE)
  withdraw(
    @Body(new ZodValidationPipe(WithdrawConsentInput))
    input: WithdrawConsentInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.consent.withdraw(input.email, principal.userId);
  }
}
