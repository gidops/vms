import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { PERMISSIONS, UpdateAlertStatusInput } from '@vms/contracts';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../shared/auth/auth.decorators';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.alerts.getDetail(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ALERT_RESOLVE)
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAlertStatusInput))
    input: UpdateAlertStatusInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.alerts.updateStatus(id, input, principal.userId);
  }
}
