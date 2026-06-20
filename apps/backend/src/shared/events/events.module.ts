import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '../../prisma/prisma.module';
import { EventPublisher } from './event-publisher';
import { OutboxRelay } from './outbox.relay';
import { OutboxRepository } from './outbox.repository';
import { TransactionManager } from './transaction.manager';

@Global()
@Module({
  imports: [
    PrismaModule,
    // Wildcard listeners (e.g. audit '**') key off the '.' delimiter.
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
  ],
  providers: [
    OutboxRepository,
    EventPublisher,
    TransactionManager,
    OutboxRelay,
  ],
  exports: [EventPublisher, TransactionManager, OutboxRepository],
})
export class EventsModule {}
