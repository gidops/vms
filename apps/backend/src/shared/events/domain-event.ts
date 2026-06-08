/** Context carried with every domain event (captured from the request CLS). */
export interface EventMetadata {
  correlationId?: string;
  actorUserId?: string;
  tenantId?: string;
  locale?: string;
}

/** A fact that happened in the domain. Persisted to the outbox, then relayed. */
export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: T;
  metadata: EventMetadata;
  occurredAt: string;
}

/** Canonical event type names (dot-delimited for EventEmitter2 wildcards). */
export const EVENT_TYPES = {
  VisitorCheckedIn: 'visitor.checked_in',
  VisitorCheckedOut: 'visitor.checked_out',
  VisitApproved: 'visit.approved',
  VisitDenied: 'visit.denied',
  InvitationCreated: 'invitation.created',
  VisitorRated: 'visitor.rated',
  UserLoggedIn: 'auth.user_logged_in',
} as const;
