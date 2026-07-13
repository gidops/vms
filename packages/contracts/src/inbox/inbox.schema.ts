import { z } from "zod";
import {
  AlertStatus,
  RiskLevel,
  VisitStatus,
  VisitType,
} from "../common/enums.js";
import { PaginationQuery } from "../common/pagination.js";

/** Which slice of the inbox to return. */
export const InboxKind = z.enum(["all", "requests", "alerts"]);
export type InboxKind = z.infer<typeof InboxKind>;

export const InboxQuery = PaginationQuery.extend({
  kind: InboxKind.default("all"),
  search: z.string().optional(),
  /** `mine` restricts requests to the host's own visits (+ their visitors' alerts). */
  scope: z.enum(["all", "mine"]).default("all"),
  /** Match against the item status (VisitStatus for requests, AlertStatus for alerts). */
  status: z.string().min(1).optional(),
  /** Request-only facets — supplying either drops alerts from the result. */
  purpose: z.string().min(1).optional(),
  type: VisitType.optional(),
});
export type InboxQuery = z.infer<typeof InboxQuery>;

/** Common metadata rendered on every inbox card's footer. */
const InboxItemBase = z.object({
  id: z.string().uuid(),
  /** Visitor's organisation, emphasised in the card description. */
  organization: z.string().nullable().optional(),
  createdByName: z.string().nullable().optional(),
  notesCount: z.number().int().min(0).default(0),
  createdAt: z.coerce.date(),
  /** Last activity time — drives recency sort, "x min ago", and the unread flag. */
  updatedAt: z.coerce.date(),
  /** True when this item changed after the user last opened Requests & Alerts. */
  unread: z.boolean().default(false),
});

/**
 * A visit request card. Carries structured fields (visitor/host names, type,
 * purpose) so the frontend composes the localized, status-aware title and
 * description — the card label (Visit Request / SM Feedback) is derived from
 * `status` on the client.
 */
export const InboxRequestItem = InboxItemBase.extend({
  kind: z.literal("request"),
  visitId: z.string().uuid(),
  status: VisitStatus,
  visitorName: z.string(),
  hostName: z.string().nullable().optional(),
  type: VisitType,
  purpose: z.string(),
});
export type InboxRequestItem = z.infer<typeof InboxRequestItem>;

/** A flagged-visitor alert card. */
export const InboxAlertItem = InboxItemBase.extend({
  kind: z.literal("alert"),
  alertId: z.string().uuid(),
  status: AlertStatus,
  level: RiskLevel,
  /** Alert category (e.g. "Restricted Guest") and the flagged reason. */
  category: z.string().nullable().optional(),
  reason: z.string(),
  visitorName: z.string().nullable().optional(),
});
export type InboxAlertItem = z.infer<typeof InboxAlertItem>;

export const InboxItem = z.discriminatedUnion("kind", [
  InboxRequestItem,
  InboxAlertItem,
]);
export type InboxItem = z.infer<typeof InboxItem>;

/** Per-user unread badge count for the Requests & Alerts nav bubble. */
export const InboxUnreadCount = z.object({
  unread: z.number().int().min(0),
});
export type InboxUnreadCount = z.infer<typeof InboxUnreadCount>;
