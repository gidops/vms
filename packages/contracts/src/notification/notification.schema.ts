import { z } from "zod";
import { Locale, NotificationChannel } from "../common/enums.js";
import { PaginationQuery } from "../common/pagination.js";

/**
 * An in-app (dashboard) notification rendered for the current user. Email / SMS /
 * WhatsApp notifications are delivered out-of-band; only IN_APP rows are exposed
 * through the notifications API and the bell/toast UI.
 */
export const NotificationItem = z.object({
  id: z.string().uuid(),
  channel: NotificationChannel,
  locale: Locale,
  templateKey: z.string().min(1),
  /** Rendered, localized fields for display (title/body/href/…). */
  data: z.record(z.string(), z.unknown()).nullable().optional(),
  readAt: z.coerce.date().nullable().optional(),
  visitId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date(),
});
export type NotificationItem = z.infer<typeof NotificationItem>;

/** Query the current user's in-app notifications. */
export const NotificationQuery = PaginationQuery.extend({
  unreadOnly: z.coerce.boolean().default(false),
});
export type NotificationQuery = z.infer<typeof NotificationQuery>;
