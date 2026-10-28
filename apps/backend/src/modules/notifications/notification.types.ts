import type { NotificationChannel } from '@prisma/client';
import type { Locale } from '../../shared/i18n/i18n.service';

export const NOTIFICATION_TEMPLATES = {
  VISIT_APPROVED: 'visit.approved',
  VISITOR_ARRIVED: 'visitor.arrived',
  VISIT_THANK_YOU: 'visit.thank_you',
  /** The 6-digit code reception reads to a self-registering visitor. */
  DESK_QR_CODE: 'desk_qr.code',
  /** Admin-issued set-password link; single-use, expires in minutes. */
  PASSWORD_RESET: 'user.password_reset',
} as const;

export type NotificationTemplateKey =
  (typeof NOTIFICATION_TEMPLATES)[keyof typeof NOTIFICATION_TEMPLATES];

/** WhatsApp HSM template: required outside the 24h session window; used only when WHATSAPP_USE_TEMPLATES is on. */
export interface WhatsappTemplateMeta {
  /** Meta: approved template name. Twilio: the Content template SID (HX…). */
  name: string;
  languageCode?: string;
  vars: string[];
}

export const TEMPLATE_META: Record<
  string,
  {
    emailFile: string;
    ns: string;
    withQr?: boolean;
    whatsappTemplate?: WhatsappTemplateMeta;
  }
> = {
  [NOTIFICATION_TEMPLATES.VISIT_APPROVED]: {
    emailFile: 'visit-approved',
    ns: 'visitApproved',
    withQr: true,
  },
  [NOTIFICATION_TEMPLATES.VISITOR_ARRIVED]: {
    emailFile: 'visitor-arrived',
    ns: 'visitorArrived',
  },
  [NOTIFICATION_TEMPLATES.VISIT_THANK_YOU]: {
    emailFile: 'visit-thank-you',
    ns: 'thankYou',
  },
  [NOTIFICATION_TEMPLATES.DESK_QR_CODE]: {
    emailFile: 'desk-qr-code',
    ns: 'deskQrCode',
  },
  [NOTIFICATION_TEMPLATES.PASSWORD_RESET]: {
    emailFile: 'password-reset',
    ns: 'passwordReset',
  },
};

export interface NotificationAttachment {
  filename: string;
  content: Buffer;
  cid?: string;
  contentType?: string;
}

export interface RenderedWhatsappTemplate {
  /** Meta: approved template name. Twilio: the Content template SID (HX…). */
  name: string;
  languageCode: string;
  variables: string[];
}

export interface RenderedMessage {
  to?: string;
  subject?: string;
  html?: string;
  text?: string;
  attachments?: NotificationAttachment[];
  template?: RenderedWhatsappTemplate;
}

export interface ChannelTarget {
  channel: NotificationChannel;
  recipient?: string | null;
  userId?: string | null;
  visitorEmail?: string | null;
}

export interface EnqueueSpec {
  templateKey: NotificationTemplateKey;
  locale: Locale;
  visitId?: string | null;
  data: Record<string, unknown>;
  channels: ChannelTarget[];
}
