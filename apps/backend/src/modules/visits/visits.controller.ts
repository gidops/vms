import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  AdminStatsQuery,
  AdminTrafficQuery,
  BulkApproveVisitsInput,
  BulkDenyVisitsInput,
  CheckInVisitInput,
  CheckOutVisitInput,
  CreateVisitsInput,
  DenyVisitInput,
  ExportVisitsQuery,
  FlagVisitInput,
  PERMISSIONS,
  RateVisitInput,
  RequestInfoInput,
  ResubmitVisitInput,
  UpdateVisitRequestInput,
  VisitListQuery,
} from '@vms/contracts';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../shared/auth/auth.decorators';
import { canReadAllVisits } from '../../shared/auth/visit-scope';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { VisitAccessService } from './access.service';
import { VisitDashboardService } from './dashboard.service';
import { VisitAuthoringService } from './authoring.service';
import { VisitDeliveriesService } from './deliveries.service';
import { VisitEvacuationService } from './evacuation.service';
import { ExportAbortedError, VisitExportService } from './export.service';
import { VisitModerationService } from './moderation.service';
import { VisitReadService } from './read.service';

@Controller('visits')
export class VisitsController {
  private readonly logger = new Logger(VisitsController.name);

  constructor(
    private readonly dashboard: VisitDashboardService,
    private readonly read: VisitReadService,
    private readonly authoring: VisitAuthoringService,
    private readonly moderation: VisitModerationService,
    private readonly access: VisitAccessService,
    private readonly evacuation: VisitEvacuationService,
    private readonly exporter: VisitExportService,
    private readonly deliveries: VisitDeliveriesService,
  ) {}

  /** Principals without `visit:read` are always limited to the "mine" scope. */
  @Get()
  list(
    @Query(new ZodValidationPipe(VisitListQuery)) query: VisitListQuery,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.read.list(query, principal.userId, canReadAllVisits(principal));
  }

  @Get('evacuation-roll')
  @RequirePermissions(PERMISSIONS.EVACUATION_READ)
  evacuationRoll() {
    return this.evacuation.roll();
  }

  /** CSV/Excel by WAT visit date (max 366 days), streamed and audit-logged. */
  @Get('export')
  @RequirePermissions(PERMISSIONS.REPORT_EXPORT)
  async export(
    @Query(new ZodValidationPipe(ExportVisitsQuery)) query: ExportVisitsQuery,
    @CurrentUser() principal: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', this.exporter.contentType(query));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${this.exporter.filename(query)}"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    try {
      await this.exporter.write(query, res, principal.userId);
    } catch (err) {
      // The client left mid-download; the export is already audited as failed.
      if (err instanceof ExportAbortedError) return;
      // Once bytes are sent the status can't change, so cut the download short instead.
      if (!res.headersSent) throw err;
      this.logger.error(
        `Visitor export failed after streaming began: ${String(err)}`,
      );
      res.destroy(err instanceof Error ? err : undefined);
    }
  }

  @Post()
  @RequirePermissions(PERMISSIONS.INVITATION_CREATE)
  create(
    @Body(new ZodValidationPipe(CreateVisitsInput)) input: CreateVisitsInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.authoring.createVisits(input, principal.userId);
  }

  @Get('dashboard/stats')
  @RequirePermissions(PERMISSIONS.VISIT_APPROVE)
  dashboardStats(
    @Query(new ZodValidationPipe(AdminStatsQuery)) query: AdminStatsQuery,
  ) {
    return this.dashboard.stats(query);
  }

  @Get('dashboard/desk-stats')
  @RequirePermissions(PERMISSIONS.VISIT_CHECK_IN)
  deskStats() {
    return this.dashboard.deskStats();
  }

  @Get('dashboard/traffic')
  @RequirePermissions(PERMISSIONS.REPORT_READ)
  dashboardTraffic(
    @Query(new ZodValidationPipe(AdminTrafficQuery)) query: AdminTrafficQuery,
  ) {
    return this.dashboard.traffic(query);
  }

  /** History readers may open any visit here while their lists stay scoped. */
  @Get(':id')
  async getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() principal: AuthUser,
  ) {
    if (
      !canReadAllVisits(principal) &&
      !principal.permissions.includes(PERMISSIONS.HISTORY_READ)
    ) {
      await this.read.assertCanView(id, principal.userId);
    }
    return this.read.getDetail(id);
  }

  @Get(':id/notifications')
  @RequirePermissions(PERMISSIONS.NOTIFICATION_READ)
  notifications(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.deliveries.list(id, principal);
  }

  @Post(':id/notifications/:notificationId/retry')
  @HttpCode(200)
  @RequirePermissions(
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.NOTIFICATION_RETRY,
  )
  retryNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.deliveries.retry(id, notificationId, principal);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.VISIT_CANCEL)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.authoring.cancel(id, principal.userId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.VISIT_EDIT)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateVisitRequestInput))
    input: UpdateVisitRequestInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.authoring.update(id, input, principal.userId);
  }

  @Post(':id/resubmit')
  @RequirePermissions(PERMISSIONS.INVITATION_CREATE)
  resubmit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ResubmitVisitInput)) input: ResubmitVisitInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.authoring.resubmit(id, input, principal.userId);
  }

  @Post('bulk-approve')
  @RequirePermissions(PERMISSIONS.VISIT_APPROVE)
  bulkApprove(
    @Body(new ZodValidationPipe(BulkApproveVisitsInput))
    input: BulkApproveVisitsInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.moderation.bulkApprove(input.visitIds, principal.userId);
  }

  @Post('bulk-deny')
  @RequirePermissions(PERMISSIONS.VISIT_DENY)
  bulkDeny(
    @Body(new ZodValidationPipe(BulkDenyVisitsInput))
    input: BulkDenyVisitsInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.moderation.bulkDeny(
      input.visitIds,
      input.reason,
      principal.userId,
    );
  }

  @Post(':id/approve')
  @RequirePermissions(PERMISSIONS.VISIT_APPROVE)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.moderation.approve(id, principal.userId);
  }

  @Post(':id/deny')
  @RequirePermissions(PERMISSIONS.VISIT_DENY)
  deny(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(DenyVisitInput)) input: DenyVisitInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.moderation.deny(id, input.reason, principal.userId);
  }

  @Post(':id/flag')
  @RequirePermissions(PERMISSIONS.VISIT_FLAG)
  flag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(FlagVisitInput)) input: FlagVisitInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.moderation.flag(id, input, principal.userId);
  }

  @Post(':id/request-info')
  @RequirePermissions(PERMISSIONS.VISIT_REQUEST_INFO)
  requestInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(RequestInfoInput)) input: RequestInfoInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.moderation.requestInfo(id, input, principal.userId);
  }

  @Post(':id/resend-code')
  @RequirePermissions(PERMISSIONS.INVITATION_CREATE)
  resendCode(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.authoring.resendCode(id, principal.userId);
  }

  /** Ownership is enforced in the service. */
  @Post(':id/rating')
  rate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(RateVisitInput)) input: RateVisitInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.access.rate(id, input, principal.userId);
  }

  @Post(':id/check-in')
  @RequirePermissions(PERMISSIONS.VISIT_CHECK_IN)
  checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CheckInVisitInput)) input: CheckInVisitInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.access.checkIn(id, input, principal.userId);
  }

  @Post(':id/check-out')
  @RequirePermissions(PERMISSIONS.VISIT_CHECK_OUT)
  checkOut(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CheckOutVisitInput)) input: CheckOutVisitInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.access.checkOut(id, input, principal.userId);
  }
}
