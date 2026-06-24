import { z } from "zod";
import { AlertStatus, RiskLevel, VisitStatus } from "../common/enums.js";
import { PaginationQuery } from "../common/pagination.js";

/** Which slice of the inbox to return. */
export const InboxKind = z.enum(["all", "requests", "alerts"]);
export type InboxKind = z.infer<typeof InboxKind>;

export const InboxQuery = PaginationQuery.extend({
  kind: InboxKind.default("all"),
  search: z.string().optional(),
  /** `mine` restricts requests to the host's own visits (+ their visitors' alerts). */
  scope: z.enum(["all", "mine"]).default("all"),
});
export type InboxQuery = z.infer<typeof InboxQuery>;

/** Common metadata rendered on every inbox card's footer. */
const InboxItemBase = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string(),
  /** Visitor's organisation, emphasised in the card description. */
  organization: z.string().nullable().optional(),
  createdByName: z.string().nullable().optional(),
  notesCount: z.number().int().min(0).default(0),
  createdAt: z.coerce.date(),
});

/** A visit request card. */
export const InboxRequestItem = InboxItemBase.extend({
  kind: z.literal("request"),
  visitId: z.string().uuid(),
  status: VisitStatus,
});
export type InboxRequestItem = z.infer<typeof InboxRequestItem>;

/** A flagged-visitor alert card. */
export const InboxAlertItem = InboxItemBase.extend({
  kind: z.literal("alert"),
  alertId: z.string().uuid(),
  status: AlertStatus,
  level: RiskLevel,
});
export type InboxAlertItem = z.infer<typeof InboxAlertItem>;

export const InboxItem = z.discriminatedUnion("kind", [
  InboxRequestItem,
  InboxAlertItem,
]);
export type InboxItem = z.infer<typeof InboxItem>;
