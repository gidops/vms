import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationDispatcher } from './notification.dispatcher';
import { NotificationListener } from './notification.listener';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';
import { QrService } from './qr/qr.service';
import { TemplateService } from './templates/template.service';
import { ChannelRegistry } from './transports/channel.registry';
import { EmailTransport } from './transports/email/email.transport';
import { LogEmailProvider } from './transports/email/log.provider';
import { SendgridProvider } from './transports/email/sendgrid.provider';
import { SmtpProvider } from './transports/email/smtp.provider';
import { SmsTransport } from './transports/sms/sms.transport';
import { NOTIFICATION_TRANSPORTS } from './transports/transport.interface';
import { TwilioClientProvider } from './transports/twilio.client';
import { LogWhatsappProvider } from './transports/whatsapp/log.provider';
import { MetaCloudWhatsappProvider } from './transports/whatsapp/meta.provider';
import { TwilioWhatsappProvider } from './transports/whatsapp/twilio.provider';
import { WhatsappTransport } from './transports/whatsapp/whatsapp.transport';

/**
 * Notification system: event listeners enqueue durable Notification rows; a
 * polling dispatcher renders (MJML+Handlebars / i18n text) and delivers them via
 * pluggable, individually-toggleable channel transports (Email/SMS/WhatsApp/
 * In-App). I18nModule, CryptoModule, ConfigModule and EventsModule are global.
 */
@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    NotificationRepository,
    NotificationDispatcher,
    NotificationListener,
    TemplateService,
    QrService,
    ChannelRegistry,
    // Email
    EmailTransport,
    SmtpProvider,
    SendgridProvider,
    LogEmailProvider,
    // SMS (Twilio)
    SmsTransport,
    TwilioClientProvider,
    // WhatsApp — provider-swappable via WHATSAPP_PROVIDER (twilio | meta)
    WhatsappTransport,
    TwilioWhatsappProvider,
    MetaCloudWhatsappProvider,
    LogWhatsappProvider,
    // The set of channel transports the dispatcher routes to.
    {
      provide: NOTIFICATION_TRANSPORTS,
      useFactory: (
        email: EmailTransport,
        sms: SmsTransport,
        whatsapp: WhatsappTransport,
      ) => [email, sms, whatsapp],
      inject: [EmailTransport, SmsTransport, WhatsappTransport],
    },
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
