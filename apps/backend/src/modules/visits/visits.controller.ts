import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  BulkApproveVisitsInput,
  BulkDenyVisitsInput,
  CheckInVisitInput,
  CheckOutVisitInput,
  CreateVisitsInput,
  DenyVisitInput,
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
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { VisitAccessService } from './access.service';
import { VisitAuthoringService } from './authoring.service';
import { VisitModerationService } from './moderation.service';
import { VisitReadService } from './read.service';

@Controller('visits')
export class VisitsController {
  constructor(
    private readonly read: VisitReadService,
    private readonly authoring: VisitAuthoringService,
    private readonly moderation: VisitModerationService,
    private readonly access: VisitAccessService,
  ) {}

  /**
   * Visit list. The admin approval queue (filter by status) and — with
   * `scope=mine` — the staff "My Visits" / "Recent Visitors" views, which are
   * restricted to the requesting user's hosted visits.
   */
  @Get()
  list(
    @Query(new ZodValidationPipe(VisitListQuery)) query: VisitListQuery,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.read.list(query, principal.userId);
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

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.read.getDetail(id);
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
