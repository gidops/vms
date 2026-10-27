import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CreateDeskQrInput,
  PERMISSIONS,
  UpdateDeskQrInput,
  type DeskQrView,
} from '@vms/contracts';
import { z } from 'zod';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../shared/auth/auth.decorators';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { DeskQrService } from './desk-qr.service';

const PngQuery = z.object({
  size: z.coerce.number().int().min(256).max(2048).default(1024),
});

@Controller('desk-qr')
export class DeskQrController {
  constructor(private readonly deskQr: DeskQrService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ISSUER_READ)
  get(): Promise<DeskQrView | null> {
    return this.deskQr.get();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ISSUER_MANAGE)
  create(
    @Body(new ZodValidationPipe(CreateDeskQrInput)) input: CreateDeskQrInput,
    @CurrentUser() principal: AuthUser,
  ): Promise<DeskQrView> {
    return this.deskQr.create(input, principal.userId);
  }

  @Patch()
  @RequirePermissions(PERMISSIONS.ISSUER_MANAGE)
  update(
    @Body(new ZodValidationPipe(UpdateDeskQrInput)) input: UpdateDeskQrInput,
    @CurrentUser() principal: AuthUser,
  ): Promise<DeskQrView> {
    return this.deskQr.update(input, principal.userId);
  }

  @Post('rotate')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.ISSUER_MANAGE)
  rotate(@CurrentUser() principal: AuthUser): Promise<DeskQrView> {
    return this.deskQr.rotate(principal.userId);
  }

  @Post('disable')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.ISSUER_MANAGE)
  disable(@CurrentUser() principal: AuthUser): Promise<DeskQrView> {
    return this.deskQr.disable(principal.userId);
  }

  @Post('enable')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.ISSUER_MANAGE)
  enable(@CurrentUser() principal: AuthUser): Promise<DeskQrView> {
    return this.deskQr.enable(principal.userId);
  }

  @Get('qr.png')
  @RequirePermissions(PERMISSIONS.ISSUER_READ)
  async png(
    @Query(new ZodValidationPipe(PngQuery)) query: z.infer<typeof PngQuery>,
    @Res() res: Response,
  ): Promise<void> {
    const png = await this.deskQr.png(query.size);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="aatc-desk-qr.png"',
    );
    res.setHeader('Cache-Control', 'no-store');
    res.send(png);
  }
}
