import { Controller, Get, Query } from '@nestjs/common';
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
}
