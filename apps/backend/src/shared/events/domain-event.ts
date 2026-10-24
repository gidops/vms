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
  VisitFlagged: 'visit.flagged',
  VisitReviewRequested: 'visit.review_requested',
  VisitCancelled: 'visit.cancelled',
  VisitUpdated: 'visit.updated',
  InvitationCreated: 'invitation.created',
  VisitRequested: 'visit.requested',
  VisitInviteResent: 'visit.invite_resent',
  AlertCreated: 'alert.created',
  AlertUpdated: 'alert.updated',
  NoteAdded: 'note.added',
  VisitorRated: 'visitor.rated',
  /** Recorded before the first byte of a visitor export is sent. */
  VisitsExportStarted: 'report.visits_export_started',
  /** Same export id as the start row, with the final row count. */
  VisitsExported: 'report.visits_exported',
  /** Same export id; the stream broke (client abort, DB error) part-way. */
  VisitsExportFailed: 'report.visits_export_failed',
  DeskQrCreated: 'desk_qr.created',
  /** The printed V1 issuer QR was taken over as the desk QR at cutover. */
  DeskQrImported: 'desk_qr.imported',
  DeskQrUpdated: 'desk_qr.updated',
  /** New token: the printed poster stops working. */
  DeskQrRotated: 'desk_qr.rotated',
  DeskQrDisabled: 'desk_qr.disabled',
  DeskQrEnabled: 'desk_qr.enabled',
  /** A visitor submitted the form; a code went to the desk inbox. */
  DeskQrCodeSent: 'desk_qr.code_sent',
  ConsentWithdrawn: 'consent.withdrawn',
  ConsentExported: 'consent.exported',
  NotificationRetried: 'notification.retried',
  /** An RFID access card was issued to a visitor (Operations → Access cards). */
  RfidCardAssigned: 'rfid_card.assigned',
  /** Validity, photo or notes changed on an active RFID card. */
  RfidCardUpdated: 'rfid_card.updated',
  /** The card was sent to the card printer (each reprint is its own row). */
  RfidCardPrinted: 'rfid_card.printed',
  RfidCardReturned: 'rfid_card.returned',
  RfidCardLost: 'rfid_card.lost',
  /** A card was marked found again (available) or retired. */
  RfidCardStatusChanged: 'rfid_card.status_changed',
  /** Recorded before the first byte of an audit-trail export is sent. */
  AuditExportStarted: 'audit.export_started',
  /** Same export id as the start row, with the final row count. */
  AuditExported: 'audit.exported',
  UserLoggedIn: 'auth.user_logged_in',
  UserCreated: 'user.created',
  UserRolesUpdated: 'user.roles_updated',
  UserProfileUpdated: 'user.profile_updated',
  UserPasswordChanged: 'user.password_changed',
  UserDeleted: 'user.deleted',
  // Security events recorded directly (no successful business transaction to
  // ride the outbox), via SecurityAuditService → AuditLog + Seq.
  LoginFailed: 'auth.login_failed',
  SignupBlocked: 'auth.signup_blocked',
  Logout: 'auth.logout',
  TokenRefreshed: 'auth.token_refreshed',
  RefreshReuseDetected: 'auth.refresh_reuse_detected',
  RoleSwitched: 'auth.role_switched',
  PermissionDenied: 'authz.permission_denied',
} as const;
