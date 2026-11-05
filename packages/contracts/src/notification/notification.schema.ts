import { z } from "zod";
import { Locale, NotificationChannel } from "../common/enums.js";
import { PaginationQuery } from "../common/pagination.js";

/** Only IN_APP rows are exposed; other channels are delivered out-of-band. */
export const NotificationItem = z.object({
  id: z.string().uuid(),
  channel: NotificationChannel,
  locale: Locale,
  templateKey: z.string().min(1),
  data: z.record(z.string(), z.unknown()).nullable().optional(),
  readAt: z.coerce.date().nullable().optional(),
  visitId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date(),
});
export type NotificationItem = z.infer<typeof NotificationItem>;

export const NotificationQuery = PaginationQuery.extend({
  unreadOnly: z.coerce.boolean().default(false),
});
export type NotificationQuery = z.infer<typeof NotificationQuery>;

/** SENT = accepted by the provider, not delivered. */
export const NotificationDeliveryStatus = z.enum(["PENDING", "SENT", "FAILED"]);
export type NotificationDeliveryStatus = z.infer<
  typeof NotificationDeliveryStatus
>;

/** Recipient is masked; `error` is returned only to Security Manager / System Admin. */
export const NotificationDelivery = z.object({
  id: z.string().uuid(),
  channel: z.enum(["EMAIL", "SMS", "WHATSAPP"]),
  templateKey: z.string(),
  recipientMasked: z.string().nullable(),
  status: NotificationDeliveryStatus,
  attempts: z.number().int().min(0),
  error: z.string().nullable(),
  sentAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export type NotificationDelivery = z.infer<typeof NotificationDelivery>;
