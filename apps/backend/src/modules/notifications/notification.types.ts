import type { NotificationChannel } from '@prisma/client';
import type { Locale } from '../../shared/i18n/i18n.service';

/** Canonical notification template keys (drive template + i18n namespace lookup). */
export const NOTIFICATION_TEMPLATES = {
  VISIT_APPROVED: 'visit.approved',
  VISITOR_ARRIVED: 'visitor.arrived',
  VISIT_THANK_YOU: 'visit.thank_you',
} as const;

export type NotificationTemplateKey =
  (typeof NOTIFICATION_TEMPLATES)[keyof typeof NOTIFICATION_TEMPLATES];

/**
 * An approved WhatsApp message template (HSM). Business-initiated WhatsApp
 * messages sent outside a 24h session window must use a pre-approved template
 * rather than free-form text. `vars` lists the payload keys, in order, that fill
 * the template's positional variables. Only used when `WHATSAPP_USE_TEMPLATES`
 * is on; otherwise the free-text catalog copy is sent (works in the Twilio
 * sandbox and within 24h sessions).
 */
export interface WhatsappTemplateMeta {
  /** Meta: approved template name. Twilio: the Content template SID (HX…). */
  name: string;
  /** BCP-47-ish code (e.g. `en`, `fr`, `ar`); defaults to the render locale. */
  languageCode?: string;
  /** Payload keys, in order, mapped to the template's positional variables. */
  vars: string[];
}

/** Maps a template key to its email file + i18n sub-namespace + QR/template flags. */
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
};

/** An attachment (used for inline email QR codes via CID). */
export interface NotificationAttachment {
  filename: string;
  content: Buffer;
  cid?: string;
  contentType?: string;
}

/** A resolved WhatsApp template ready for a provider to send. */
export interface RenderedWhatsappTemplate {
  /** Meta: approved template name. Twilio: the Content template SID (HX…). */
  name: string;
  /** BCP-47-ish language code (e.g. `en`, `fr`, `ar`). */
  languageCode: string;
  /** Positional variable values, in order. */
  variables: string[];
}

/** A rendered, ready-to-send message for a single channel. */
export interface RenderedMessage {
  to?: string;
  subject?: string;
  html?: string;
  text?: string;
  attachments?: NotificationAttachment[];
  /** WhatsApp approved-template payload (when templates are enabled). */
  template?: RenderedWhatsappTemplate;
}

/** One delivery target for a notification (channel + resolved recipient). */
export interface ChannelTarget {
  channel: NotificationChannel;
  /** Address/phone for EMAIL/SMS/WHATSAPP; omitted for IN_APP. */
  recipient?: string | null;
  /** Owning user (required for IN_APP; optional otherwise). */
  userId?: string | null;
  visitorEmail?: string | null;
}

/** A request to enqueue a notification across one or more channels. */
export interface EnqueueSpec {
  templateKey: NotificationTemplateKey;
  locale: Locale;
  visitId?: string | null;
  data: Record<string, unknown>;
  channels: ChannelTarget[];
}
