import { Body, Controller, Post } from '@nestjs/common';
import { AddNoteInput, PERMISSIONS } from '@vms/contracts';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../shared/auth/auth.decorators';
import { ZodValidationPipe } from '../../shared/common/pipes/zod-validation.pipe';
import { NotesService } from './notes.service';

@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.NOTE_ADD)
  add(
    @Body(new ZodValidationPipe(AddNoteInput)) input: AddNoteInput,
    @CurrentUser() principal: AuthUser,
  ) {
    return this.notes.add(input, principal.userId);
  }
}
