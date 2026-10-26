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
import { VisitExportService } from './export.service';
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

  /**
   * Visit list. The admin approval queue (filter by status) and — with
   * `scope=mine` — the staff "My Visits" / "Recent Visitors" views, which are
   * restricted to the requesting user's hosted visits. Principals without
   * `visit:read` (staff, gate) are always limited to the "mine" scope.
   */
  @Get()
  list(
    @Query(new ZodValidationPipe(VisitListQuery)) query: VisitListQuery,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.read.list(query, principal.userId, canReadAllVisits(principal));
  }

  /** Live Evacuation Roll — checked-in visitors who need evacuation help. */
  @Get('evacuation-roll')
  @RequirePermissions(PERMISSIONS.EVACUATION_READ)
  evacuationRoll() {
    return this.evacuation.roll();
  }

  /**
   * Visitor export (CSV / Excel) by WAT visit date, max 366 days. Streamed as a
   * download; audit-logged with the range, format and row count.
   */
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
      // Once bytes have gone out the status can't change, so the exception
      // filter can't answer; log it and cut the download short instead.
      if (!res.headersSent) throw err;
      this.logger.error(
        `Visitor export failed after streaming began: ${String(err)}`,
      );
      res.destroy(err instanceof Error ? err : undefined);
    }
  }

  /** VMC creates invite(s) / walk-in(s) for a host (one visit per visitor). */
  @Post()
  @RequirePermissions(PERMISSIONS.INVITATION_CREATE)
  create(
    @Body(new ZodValidationPipe(CreateVisitsInput)) input: CreateVisitsInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.authoring.createVisits(input, principal.userId);
  }

  /** Admin console overview counts: the System Admin and the Security Manager. */
  @Get('dashboard/stats')
  @RequirePermissions(PERMISSIONS.VISIT_APPROVE)
  dashboardStats(
    @Query(new ZodValidationPipe(AdminStatsQuery)) query: AdminStatsQuery,
  ) {
    return this.dashboard.stats(query);
  }

  /** The VMC overview's onsite / checked in / checked out counts for today. */
  @Get('dashboard/desk-stats')
  @RequirePermissions(PERMISSIONS.VISIT_CHECK_IN)
  deskStats() {
    return this.dashboard.deskStats();
  }

  /** Check-ins per hour, shown only on Analytics & Reports. */
  @Get('dashboard/traffic')
  @RequirePermissions(PERMISSIONS.REPORT_READ)
  dashboardTraffic(
    @Query(new ZodValidationPipe(AdminTrafficQuery)) query: AdminTrafficQuery,
  ) {
    return this.dashboard.traffic(query);
  }

  /**
   * One visit. Facility history readers (e.g. Read Admin) may open any visit
   * from Insights → History; their other lists stay scoped (no visit:read).
   */
  @Get(':id')
  async getOne(@Param('id') id: string, @CurrentUser() principal: AuthUser) {
    if (
      !canReadAllVisits(principal) &&
      !principal.permissions.includes(PERMISSIONS.HISTORY_READ)
    ) {
      await this.read.assertCanView(id, principal.userId);
    }
    return this.read.getDetail(id);
  }

  /** Email / SMS / WhatsApp delivery status for a visit (Guest Details). */
  @Get(':id/notifications')
  @RequirePermissions(PERMISSIONS.NOTIFICATION_READ)
  notifications(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.deliveries.list(id, principal);
  }

  /** Re-queue a failed notification for this visit. */
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
  cancel(@Param('id') id: string, @CurrentUser() principal: AuthUser) {
    return this.authoring.cancel(id, principal.userId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.VISIT_EDIT)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateVisitRequestInput))
    input: UpdateVisitRequestInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.authoring.update(id, input, principal.userId);
  }

  /**
   * Host edits & resubmits a REVIEW_REQUESTED request → back to PENDING. Authorized
   * by host ownership in the service (the host needs no global visit:edit grant).
   */
  @Post(':id/resubmit')
  @RequirePermissions(PERMISSIONS.INVITATION_CREATE)
  resubmit(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ResubmitVisitInput)) input: ResubmitVisitInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.authoring.resubmit(id, input, principal.userId);
  }

  /** Approve several visits at once (group approval sheet — Approve All/Selected). */
  @Post('bulk-approve')
  @RequirePermissions(PERMISSIONS.VISIT_APPROVE)
  bulkApprove(
    @Body(new ZodValidationPipe(BulkApproveVisitsInput))
    input: BulkApproveVisitsInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.moderation.bulkApprove(input.visitIds, principal.userId);
  }

  /** Deny several visits at once with a shared reason (group approval sheet). */
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
  approve(@Param('id') id: string, @CurrentUser() principal: AuthUser) {
    return this.moderation.approve(id, principal.userId);
  }

  @Post(':id/deny')
  @RequirePermissions(PERMISSIONS.VISIT_DENY)
  deny(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(DenyVisitInput)) input: DenyVisitInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.moderation.deny(id, input.reason, principal.userId);
  }

  /** Security Manager/admin flags a visit as a security concern → FLAGGED + SECURITY_REVIEW alert. */
  @Post(':id/flag')
  @RequirePermissions(PERMISSIONS.VISIT_FLAG)
  flag(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(FlagVisitInput)) input: FlagVisitInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.moderation.flag(id, input, principal.userId);
  }

  /** Security Manager/admin requests more info → REVIEW_REQUESTED + ADDITIONAL_INFO alert. */
  @Post(':id/request-info')
  @RequirePermissions(PERMISSIONS.VISIT_REQUEST_INFO)
  requestInfo(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RequestInfoInput)) input: RequestInfoInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.moderation.requestInfo(id, input, principal.userId);
  }

  /**
   * Host resubmits nothing here — re-sends the guest's invite code/QR email.
   * Authorized by host/creator ownership in the service.
   */
  @Post(':id/resend-code')
  @RequirePermissions(PERMISSIONS.INVITATION_CREATE)
  resendCode(@Param('id') id: string, @CurrentUser() principal: AuthUser) {
    return this.authoring.resendCode(id, principal.userId);
  }

  /** Host rates a completed visit (1-5). Authorized by host/creator in the service. */
  @Post(':id/rating')
  rate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RateVisitInput)) input: RateVisitInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.access.rate(id, input, principal.userId);
  }

  /** VMC check-in: assign a physical badge to an approved visit, mark it on-site. */
  @Post(':id/check-in')
  @RequirePermissions(PERMISSIONS.VISIT_CHECK_IN)
  checkIn(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CheckInVisitInput)) input: CheckInVisitInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.access.checkIn(id, input, principal.userId);
  }

  /** VMC check-out: release the badge and mark the visitor off-site. */
  @Post(':id/check-out')
  @RequirePermissions(PERMISSIONS.VISIT_CHECK_OUT)
  checkOut(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CheckOutVisitInput)) input: CheckOutVisitInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.access.checkOut(id, input, principal.userId);
  }
}
