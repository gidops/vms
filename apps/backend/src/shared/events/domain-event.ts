export interface EventMetadata {
  correlationId?: string;
  actorUserId?: string;
  tenantId?: string;
  locale?: string;
  ip?: string;
  userAgent?: string;
}

export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: T;
  metadata: EventMetadata;
  occurredAt: string;
}

/** Dot-delimited for EventEmitter2 wildcards. */
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
  VisitsExported: 'report.visits_exported',
  VisitsExportFailed: 'report.visits_export_failed',
  DeskQrCreated: 'desk_qr.created',
  /** A printed legacy issuer QR was adopted as the desk QR. */
  DeskQrImported: 'desk_qr.imported',
  /** The printed poster stops working. */
  DeskQrRotated: 'desk_qr.rotated',
  DeskQrDisabled: 'desk_qr.disabled',
  DeskQrEnabled: 'desk_qr.enabled',
  // Security event (no business transaction), recorded via SecurityAuditService.
  DeskQrHoneypotTriggered: 'desk_qr.honeypot_triggered',
  ConsentWithdrawn: 'consent.withdrawn',
  ConsentGranted: 'consent.granted',
  ConsentExported: 'consent.exported',
  NotificationRetried: 'notification.retried',
  RfidCardAssigned: 'rfid_card.assigned',
  RfidCardUpdated: 'rfid_card.updated',
  /** Each reprint is its own row. */
  RfidCardPrinted: 'rfid_card.printed',
  RfidCardReturned: 'rfid_card.returned',
  RfidCardLost: 'rfid_card.lost',
  RfidCardStatusChanged: 'rfid_card.status_changed',
  /** Recorded before the first byte of an audit-trail export is sent. */
  AuditExportStarted: 'audit.export_started',
  AuditExported: 'audit.exported',
  UserLoggedIn: 'auth.user_logged_in',
  UserCreated: 'user.created',
  UserRolesUpdated: 'user.roles_updated',
  UserProfileUpdated: 'user.profile_updated',
  UserPasswordChanged: 'user.password_changed',
  /** An admin activated or deactivated the account. */
  UserStatusChanged: 'user.status_changed',
  /** An admin sent the user an expiring password-reset link. */
  PasswordResetRequested: 'user.password_reset_requested',
  /** The user set a new password through the emailed link. */
  PasswordResetCompleted: 'user.password_reset_completed',
  UserDeleted: 'user.deleted',
  // No business transaction to ride the outbox; recorded via SecurityAuditService.
  LoginFailed: 'auth.login_failed',
  SignupBlocked: 'auth.signup_blocked',
  Logout: 'auth.logout',
  TokenRefreshed: 'auth.token_refreshed',
  RefreshReuseDetected: 'auth.refresh_reuse_detected',
  /** Invalid, expired or re-used reset link presented. */
  PasswordResetRejected: 'auth.password_reset_rejected',
  RoleSwitched: 'auth.role_switched',
  PermissionDenied: 'authz.permission_denied',
} as const;
