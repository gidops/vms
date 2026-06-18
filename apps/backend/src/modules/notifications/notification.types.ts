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

/** Maps a template key to its email file + i18n sub-namespace + QR flag. */
export const TEMPLATE_META: Record<
  string,
  { emailFile: string; ns: string; withQr?: boolean }
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

/** A rendered, ready-to-send message for a single channel. */
export interface RenderedMessage {
  to?: string;
  subject?: string;
  html?: string;
  text?: string;
  attachments?: NotificationAttachment[];
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
