import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AccessCardsModule } from './modules/access-cards/access-cards.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { AuditTrailModule } from './modules/audit-trail/audit-trail.module';
import { ConsentModule } from './modules/consent/consent.module';
import { DeskQrModule } from './modules/desk-qr/desk-qr.module';
import { GateModule } from './modules/gate/gate.module';
import { IdentityModule } from './modules/identity/identity.module';
import { InboxModule } from './modules/inbox/inbox.module';
import { InsightsModule } from './modules/insights/insights.module';
import { NotesModule } from './modules/notes/notes.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RfidCardsModule } from './modules/rfid-cards/rfid-cards.module';
import { StaffModule } from './modules/staff/staff.module';
import { VisitsModule } from './modules/visits/visits.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './shared/audit/audit.module';
import { AuthModule } from './shared/auth/auth.module';
import { AllExceptionsFilter } from './shared/common/filters/all-exceptions.filter';
import { ConfigModule } from './shared/config/config.module';
import { CryptoModule } from './shared/crypto/crypto.module';
import { EventsModule } from './shared/events/events.module';
import { I18nModule } from './shared/i18n/i18n.module';
import { LoggingModule } from './shared/logging/logging.module';
import { StorageModule } from './shared/storage/storage.module';

@Module({
  imports: [
    ConfigModule,
    I18nModule,
    LoggingModule,
    PrismaModule,
    CryptoModule,
    StorageModule,
    EventsModule,
    AuditModule,
    IdentityModule,
    AuthModule,
    InboxModule,
    VisitsModule,
    InsightsModule,
    ConsentModule,
    DeskQrModule,
    GateModule,
    AccessCardsModule,
    RfidCardsModule,
    AuditTrailModule,
    AlertsModule,
    NotesModule,
    NotificationsModule,
    StaffModule,
  ],
  controllers: [AppController],
  // AllExceptionsFilter is registered here (not in main.ts) so it can inject
  // I18nService + ClsService for localized RFC-7807 error responses.
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
