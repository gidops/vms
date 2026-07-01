import { Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { InboxQuery } from '@vms/contracts';
import { CurrentUser, type AuthUser } from '../../shared/auth/auth.decorators';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { InboxService } from './inbox.service';

@Controller('inbox')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(InboxQuery)) query: InboxQuery,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.inbox.list(query, principal.userId);
  }

  /** Unread count for the Requests & Alerts nav bubble (per current user). */
  @Get('unread-count')
  unreadCount(
    @Query(new ZodValidationPipe(InboxQuery)) query: InboxQuery,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.inbox.unreadCount(query, principal.userId);
  }

  /** Mark all items read for the current user (called when the page is opened). */
  @Post('seen')
  @HttpCode(200)
  markSeen(@CurrentUser() principal: AuthUser) {
    return this.inbox.markSeen(principal.userId);
  }
}
