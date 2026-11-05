import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  CreatePassesInput,
  MarkPassesPrintedInput,
  PassDemandQuery,
  PERMISSIONS,
  RecordPassesInput,
  RetirePassInput,
  VisitorPassQuery,
} from '@vms/contracts';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../shared/auth/auth.decorators';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { VisitorPassesService } from './visitor-passes.service';

/** Producing visitor passes (System Admin). Assigning them is reception's job. */
@Controller('visitor-passes')
@RequirePermissions(PERMISSIONS.PASS_MANAGE)
export class VisitorPassesController {
  constructor(private readonly passes: VisitorPassesService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(VisitorPassQuery)) query: VisitorPassQuery,
  ) {
    return this.passes.list(query);
  }

  @Get('summary')
  summary() {
    return this.passes.summary();
  }

  @Get('demand')
  demand(
    @Query(new ZodValidationPipe(PassDemandQuery)) query: PassDemandQuery,
  ) {
    return this.passes.demand(query.days);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.passes.get(id);
  }

  @Post('batches')
  createBatch(
    @Body(new ZodValidationPipe(CreatePassesInput)) input: CreatePassesInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.passes.createBatch(input, principal.userId);
  }

  @Post('record')
  @HttpCode(200)
  record(
    @Body(new ZodValidationPipe(RecordPassesInput)) input: RecordPassesInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.passes.record(input, principal.userId);
  }

  @Post('printed')
  @HttpCode(200)
  printed(
    @Body(new ZodValidationPipe(MarkPassesPrintedInput))
    input: MarkPassesPrintedInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.passes.markPrinted(input, principal.userId);
  }

  @Post(':id/retire')
  @HttpCode(200)
  retire(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(RetirePassInput)) input: RetirePassInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.passes.retire(id, input.note, principal.userId);
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  reactivate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.passes.reactivate(id, principal.userId);
  }
}
