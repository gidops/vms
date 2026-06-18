import {
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { NotificationQuery } from '@vms/contracts';
import { CurrentUser, type AuthUser } from '../../shared/auth/auth.decorators';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { NotificationService } from './notification.service';

/** In-app (dashboard) notifications for the current user. */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(NotificationQuery)) query: NotificationQuery,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.notifications.list(principal.userId, query);
  }

  @Patch(':id/read')
  @HttpCode(200)
  markRead(@Param('id') id: string, @CurrentUser() principal: AuthUser) {
    return this.notifications.markRead(principal.userId, id);
  }

  @Post('read-all')
  @HttpCode(200)
  markAllRead(@CurrentUser() principal: AuthUser) {
    return this.notifications.markAllRead(principal.userId);
  }
}
