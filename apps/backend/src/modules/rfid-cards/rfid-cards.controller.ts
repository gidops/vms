import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  AssignRfidCardInput,
  CloseRfidAssignmentInput,
  PERMISSIONS,
  PresignImageInput,
  RfidAssignmentListQuery,
  RfidCardListQuery,
  SetRfidCardStatusInput,
  UpdateRfidAssignmentInput,
} from '@vms/contracts';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../shared/auth/auth.decorators';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { RfidCardsService } from './rfid-cards.service';

/** Operations → Access cards (personalised RFID cards). System Admin only. */
@Controller('rfid-cards')
@RequirePermissions(PERMISSIONS.RFID_MANAGE)
export class RfidCardsController {
  constructor(private readonly cards: RfidCardsService) {}

  /** Card registry: every card ever logged, with its current holder. */
  @Get()
  listCards(
    @Query(new ZodValidationPipe(RfidCardListQuery)) query: RfidCardListQuery,
  ) {
    return this.cards.listCards(query);
  }

  @Post(':id/status')
  @HttpCode(204)
  async setCardStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(SetRfidCardStatusInput))
    input: SetRfidCardStatusInput,
    @CurrentUser() principal: AuthUser,
  ): Promise<void> {
    await this.cards.setCardStatus(id, input, principal.userId);
  }

  @Get('assignments')
  listAssignments(
    @Query(new ZodValidationPipe(RfidAssignmentListQuery))
    query: RfidAssignmentListQuery,
  ) {
    return this.cards.listAssignments(query);
  }

  @Get('assignments/:id')
  getAssignment(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.cards.getAssignment(id);
  }

  @Post('assignments')
  assign(
    @Body(new ZodValidationPipe(AssignRfidCardInput))
    input: AssignRfidCardInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.cards.assign(input, principal.userId);
  }

  @Patch('assignments/:id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateRfidAssignmentInput))
    input: UpdateRfidAssignmentInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.cards.update(id, input, principal.userId);
  }

  /** The card was sent to the printer (first print or reprint). */
  @Post('assignments/:id/printed')
  @HttpCode(200)
  printed(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.cards.printed(id, principal.userId);
  }

  /** The card came back, or it is lost. */
  @Post('assignments/:id/close')
  @HttpCode(200)
  close(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(CloseRfidAssignmentInput))
    input: CloseRfidAssignmentInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.cards.close(id, input, principal.userId);
  }

  /** Presigned PUT for the visitor photo printed on the card. */
  @Post('photos/presign')
  @HttpCode(200)
  presignPhoto(
    @Body(new ZodValidationPipe(PresignImageInput)) input: PresignImageInput,
  ) {
    return this.cards.presignPhoto(input.contentType);
  }
}
