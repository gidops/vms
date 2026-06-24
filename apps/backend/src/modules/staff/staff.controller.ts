import { Controller, Get, Query } from '@nestjs/common';
import { StaffActivityQuery } from '@vms/contracts';
import { CurrentUser, type AuthUser } from '../../shared/auth/auth.decorators';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { StaffService } from './staff.service';

/** Host-scoped reads powering the staff "Today's Schedule" dashboard. */
@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get('dashboard/stats')
  stats(@CurrentUser() principal: AuthUser) {
    return this.staff.stats(principal.userId);
  }

  @Get('activity-feed')
  activityFeed(
    @Query(new ZodValidationPipe(StaffActivityQuery)) query: StaffActivityQuery,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.staff.activityFeed(principal.userId, query);
  }
}
