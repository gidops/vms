import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  InsightsAnalyticsQuery,
  InsightsVisitorsQuery,
  PERMISSIONS,
  VisitListQuery,
  type InsightsScope,
} from '@vms/contracts';
import {
  CurrentUser,
  RequireAnyPermission,
  RequirePermissions,
  type AuthUser,
} from '../../shared/auth/auth.decorators';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { VisitReadService } from '../visits/read.service';
import { InsightsService } from './insights.service';

/** Facility scope needs the tab's facility permission; otherwise the caller's own visits. */
function scopeFor(principal: AuthUser, facility: string): InsightsScope {
  return principal.permissions.includes(facility) ? 'facility' : 'self';
}

@Controller('insights')
export class InsightsController {
  constructor(
    private readonly insights: InsightsService,
    private readonly read: VisitReadService,
  ) {}

  @Get('overview')
  @RequirePermissions(PERMISSIONS.OVERVIEW_READ)
  overview() {
    return this.insights.overview();
  }

  @Get('history')
  @RequireAnyPermission(PERMISSIONS.HISTORY_READ, PERMISSIONS.INSIGHTS_SELF)
  history(
    @Query(new ZodValidationPipe(VisitListQuery)) query: VisitListQuery,
    @CurrentUser() principal: AuthUser,
  ) {
    const scope = scopeFor(principal, PERMISSIONS.HISTORY_READ);
    return this.read.list(query, principal.userId, scope === 'facility');
  }

  @Get('visitors')
  @RequireAnyPermission(PERMISSIONS.VISITOR_READ, PERMISSIONS.INSIGHTS_SELF)
  visitors(
    @Query(new ZodValidationPipe(InsightsVisitorsQuery))
    query: InsightsVisitorsQuery,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.insights.visitors(
      query,
      scopeFor(principal, PERMISSIONS.VISITOR_READ),
      principal.userId,
    );
  }

  @Get('visitors/:id')
  @RequireAnyPermission(PERMISSIONS.VISITOR_READ, PERMISSIONS.INSIGHTS_SELF)
  visitor(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.insights.visitor(
      id,
      scopeFor(principal, PERMISSIONS.VISITOR_READ),
      principal.userId,
    );
  }

  @Get('analytics')
  @RequireAnyPermission(PERMISSIONS.REPORT_READ, PERMISSIONS.INSIGHTS_SELF)
  analytics(
    @Query(new ZodValidationPipe(InsightsAnalyticsQuery))
    query: InsightsAnalyticsQuery,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.insights.analytics(
      query,
      scopeFor(principal, PERMISSIONS.REPORT_READ),
      principal.userId,
      principal.permissions.includes(PERMISSIONS.VISIT_FLAG),
    );
  }
}
