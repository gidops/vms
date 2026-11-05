import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { PERMISSIONS, UpdateAlertStatusInput } from '@vms/contracts';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../shared/auth/auth.decorators';
import { canReadAllVisits } from '../../shared/auth/visit-scope';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  /** Any signed-in role; non-readers are limited to alerts on their own visits. */
  @Get(':id')
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.alerts.getDetail(
      id,
      canReadAllVisits(principal) ? undefined : principal.userId,
    );
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ALERT_RESOLVE)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateAlertStatusInput))
    input: UpdateAlertStatusInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.alerts.updateStatus(id, input, principal.userId);
  }
}
