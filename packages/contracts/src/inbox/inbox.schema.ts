import { z } from "zod";
import {
  AlertStatus,
  RiskLevel,
  VisitStatus,
  VisitType,
} from "../common/enums.js";
import { PaginationQuery } from "../common/pagination.js";

export const InboxKind = z.enum(["all", "requests", "alerts", "cards"]);
export type InboxKind = z.infer<typeof InboxKind>;

export const InboxQuery = PaginationQuery.extend({
  kind: InboxKind.default("all"),
  search: z.string().optional(),
  scope: z.enum(["all", "mine"]).default("all"),
  /** VisitStatus for requests, AlertStatus for alerts. */
  status: z.string().min(1).optional(),
  /** Request-only facets: supplying either drops alerts from the result. */
  purpose: z.string().min(1).optional(),
  type: VisitType.optional(),
});
export type InboxQuery = z.infer<typeof InboxQuery>;

const InboxItemBase = z.object({
  id: z.string().uuid(),
  organization: z.string().nullable().optional(),
  createdByName: z.string().nullable().optional(),
  notesCount: z.number().int().min(0).default(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  /** Changed since the user last opened the inbox. */
  unread: z.boolean().default(false),
});

/** Structured fields only; the client composes localized text. */
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

export const InboxAlertItem = InboxItemBase.extend({
  kind: z.literal("alert"),
  alertId: z.string().uuid(),
  status: AlertStatus,
  level: RiskLevel,
  category: z.string().nullable().optional(),
  reason: z.string(),
  visitorName: z.string().nullable().optional(),
});
export type InboxAlertItem = z.infer<typeof InboxAlertItem>;

/** An RFID card still out after its valid-until date: reception should chase it. */
export const InboxCardItem = InboxItemBase.extend({
  kind: z.literal("card"),
  assignmentId: z.string().uuid(),
  cardNumber: z.string(),
  validUntil: z.coerce.date(),
  visitorName: z.string(),
  visitId: z.string().uuid().nullable(),
});
export type InboxCardItem = z.infer<typeof InboxCardItem>;

export const InboxItem = z.discriminatedUnion("kind", [
  InboxRequestItem,
  InboxAlertItem,
  InboxCardItem,
]);
export type InboxItem = z.infer<typeof InboxItem>;

export const InboxUnreadCount = z.object({
  unread: z.number().int().min(0),
});
export type InboxUnreadCount = z.infer<typeof InboxUnreadCount>;
