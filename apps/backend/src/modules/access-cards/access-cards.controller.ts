import { Controller, Get, Query } from '@nestjs/common';
import { AccessCardQuery, PERMISSIONS } from '@vms/contracts';
import { RequirePermissions } from '../../shared/auth/auth.decorators';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { AccessCardsService } from './access-cards.service';

@Controller('access-cards')
export class AccessCardsController {
  constructor(private readonly cards: AccessCardsService) {}

  /** Badge pool for the check-in "Assign pass" dropdown (optionally by zone). */
  @Get()
  @RequirePermissions(PERMISSIONS.VISIT_CHECK_IN)
  list(@Query(new ZodValidationPipe(AccessCardQuery)) query: AccessCardQuery) {
    return this.cards.list(query);
  }
}
