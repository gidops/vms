import { Controller, Get, HttpCode, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PERMISSIONS, type GateKioskView } from '@vms/contracts';
import { z } from 'zod';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../shared/auth/auth.decorators';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { GateKioskService } from './gate-kiosk.service';

const PngQuery = z.object({
  size: z.coerce.number().int().min(256).max(2048).default(1024),
});

/** System Admin management of the gate kiosk link (Operations → Gate kiosk). */
@Controller('gate-kiosk')
@RequirePermissions(PERMISSIONS.GATE_MANAGE)
export class GateKioskController {
  constructor(private readonly kiosk: GateKioskService) {}

  @Get()
  get(): Promise<GateKioskView | null> {
    return this.kiosk.get();
  }

  @Post()
  create(@CurrentUser() principal: AuthUser): Promise<GateKioskView> {
    return this.kiosk.create(principal.userId);
  }

  @Post('rotate')
  @HttpCode(200)
  rotate(@CurrentUser() principal: AuthUser): Promise<GateKioskView> {
    return this.kiosk.rotate(principal.userId);
  }

  @Post('disable')
  @HttpCode(200)
  disable(@CurrentUser() principal: AuthUser): Promise<GateKioskView> {
    return this.kiosk.disable(principal.userId);
  }

  @Post('enable')
  @HttpCode(200)
  enable(@CurrentUser() principal: AuthUser): Promise<GateKioskView> {
    return this.kiosk.enable(principal.userId);
  }

  @Get('qr.png')
  async png(
    @Query(new ZodValidationPipe(PngQuery)) query: z.infer<typeof PngQuery>,
    @Res() res: Response,
  ): Promise<void> {
    const png = await this.kiosk.png(query.size);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="aatc-gate-kiosk.png"',
    );
    res.setHeader('Cache-Control', 'no-store');
    res.send(png);
  }
}
