import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  DenyVisitInput,
  PERMISSIONS,
  UpdateVisitRequestInput,
} from '@vms/contracts';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../shared/auth/auth.decorators';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { VisitsService } from './visits.service';

@Controller('visits')
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.visits.getDetail(id);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.VISIT_CANCEL)
  cancel(@Param('id') id: string, @CurrentUser() principal: AuthUser) {
    return this.visits.cancel(id, principal.userId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.VISIT_EDIT)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateVisitRequestInput))
    input: UpdateVisitRequestInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.visits.update(id, input, principal.userId);
  }

  @Post(':id/approve')
  @RequirePermissions(PERMISSIONS.VISIT_APPROVE)
  approve(@Param('id') id: string, @CurrentUser() principal: AuthUser) {
    return this.visits.approve(id, principal.userId);
  }

  @Post(':id/deny')
  @RequirePermissions(PERMISSIONS.VISIT_DENY)
  deny(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(DenyVisitInput)) input: DenyVisitInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.visits.deny(id, input.reason, principal.userId);
  }
}
