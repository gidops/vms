import { Injectable, NotFoundException } from '@nestjs/common';
import type { AddNoteInput, Note } from '@vms/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_TYPES } from '../../shared/events/domain-event';
import { EventPublisher } from '../../shared/events/event-publisher';
import { TransactionManager } from '../../shared/events/transaction.manager';

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txm: TransactionManager,
    private readonly events: EventPublisher,
  ) {}

  async add(input: AddNoteInput, authorId: string): Promise<Note> {
    // Validate the target exists so we don't create orphaned notes.
    if (input.visitId) {
      const count = await this.prisma.visit.count({
        where: { id: input.visitId },
      });
      if (count === 0) throw new NotFoundException('Visit not found');
    } else if (input.alertId) {
      const count = await this.prisma.alert.count({
        where: { id: input.alertId },
      });
      if (count === 0) throw new NotFoundException('Alert not found');
    }

    const note = await this.txm.run(async (tx) => {
      const created = await tx.note.create({
        data: {
          visitId: input.visitId ?? null,
          alertId: input.alertId ?? null,
          authorId,
          body: input.body,
        },
        include: { author: true },
      });
      await this.events.publish(tx, {
        type: EVENT_TYPES.NoteAdded,
        aggregateType: input.visitId ? 'Visit' : 'Alert',
        aggregateId: input.visitId ?? input.alertId ?? created.id,
        payload: { noteId: created.id },
        metadata: { actorUserId: authorId },
      });
      return created;
    });

    return {
      id: note.id,
      visitId: note.visitId,
      alertId: note.alertId,
      authorId: note.authorId,
      authorName: note.author.fullName,
      body: note.body,
      createdAt: note.createdAt,
    };
  }
}
