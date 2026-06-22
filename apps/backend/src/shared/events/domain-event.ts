/** Context carried with every domain event (captured from the request CLS). */
export interface EventMetadata {
  correlationId?: string;
  actorUserId?: string;
  tenantId?: string;
  locale?: string;
  /** Request origin, captured from the CLS context for the audit trail. */
  ip?: string;
  userAgent?: string;
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
  VisitCancelled: 'visit.cancelled',
  VisitUpdated: 'visit.updated',
  InvitationCreated: 'invitation.created',
  VisitRequested: 'visit.requested',
  AlertUpdated: 'alert.updated',
  NoteAdded: 'note.added',
  VisitorRated: 'visitor.rated',
  UserLoggedIn: 'auth.user_logged_in',
  UserCreated: 'user.created',
  UserRolesUpdated: 'user.roles_updated',
  UserProfileUpdated: 'user.profile_updated',
  UserPasswordChanged: 'user.password_changed',
  UserDeleted: 'user.deleted',
  // Security events recorded directly (no successful business transaction to
  // ride the outbox), via SecurityAuditService → AuditLog + Seq.
  LoginFailed: 'auth.login_failed',
  Logout: 'auth.logout',
  TokenRefreshed: 'auth.token_refreshed',
  RefreshReuseDetected: 'auth.refresh_reuse_detected',
  RoleSwitched: 'auth.role_switched',
  PermissionDenied: 'authz.permission_denied',
} as const;
