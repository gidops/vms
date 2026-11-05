import 'reflect-metadata';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod, type Type } from '@nestjs/common';
import { AppController } from './app.controller';
import { AccessCardsController } from './modules/access-cards/access-cards.controller';
import { AlertsController } from './modules/alerts/alerts.controller';
import { AuditTrailController } from './modules/audit-trail/audit-trail.controller';
import { ConsentController } from './modules/consent/consent.controller';
import { DeskQrController } from './modules/desk-qr/desk-qr.controller';
import { PublicRegistrationController } from './modules/desk-qr/public-registration.controller';
import { GateKioskController } from './modules/gate/gate-kiosk.controller';
import { GateController } from './modules/gate/gate.controller';
import { UsersController } from './modules/identity/users.controller';
import { InboxController } from './modules/inbox/inbox.controller';
import { InsightsController } from './modules/insights/insights.controller';
import { NotesController } from './modules/notes/notes.controller';
import { NotificationsController } from './modules/notifications/notifications.controller';
import { RfidCardsController } from './modules/rfid-cards/rfid-cards.controller';
import { StaffController } from './modules/staff/staff.controller';
import { VisitsController } from './modules/visits/visits.controller';
import { AuthController } from './shared/auth/auth.controller';
import {
  ANY_PERMISSIONS_KEY,
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
} from './shared/auth/auth.decorators';

const CONTROLLERS: Type[] = [
  AppController,
  AccessCardsController,
  AlertsController,
  AuditTrailController,
  ConsentController,
  DeskQrController,
  PublicRegistrationController,
  GateController,
  GateKioskController,
  UsersController,
  InboxController,
  InsightsController,
  NotesController,
  NotificationsController,
  RfidCardsController,
  StaffController,
  VisitsController,
  AuthController,
];

type Access = 'public' | 'permission' | 'signed-in';

function routes(): { route: string; access: Access }[] {
  return CONTROLLERS.flatMap((controller) => {
    const base = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
    const proto = controller.prototype as Record<string, unknown>;
    return Object.getOwnPropertyNames(proto)
      .filter(
        (name) =>
          name !== 'constructor' &&
          Reflect.hasMetadata(PATH_METADATA, proto[name] as object),
      )
      .map((name) => {
        const handler = proto[name] as object;
        const method =
          RequestMethod[
            Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod
          ];
        const path = String(Reflect.getMetadata(PATH_METADATA, handler));
        const route = `${method} /${[base, path].filter((p) => p && p !== '/').join('/')}`;
        const meta = (key: string) =>
          Reflect.getMetadata(key, handler) ??
          Reflect.getMetadata(key, controller);
        const access: Access = meta(IS_PUBLIC_KEY)
          ? 'public'
          : meta(PERMISSIONS_KEY) || meta(ANY_PERMISSIONS_KEY)
            ? 'permission'
            : 'signed-in';
        return { route, access };
      });
  });
}

// Routes any signed-in user may call. Each one scopes its data to the caller in
// the service (their own profile, inbox, notifications, or visits they created
// or host). Adding a route here is a security decision — review it.
const SIGNED_IN_ROUTES = [
  'GET /alerts/:id',
  'GET /users/me',
  'PATCH /users/me',
  'POST /users/me/avatar/presign',
  'PUT /users/me/avatar',
  'GET /users/me/sessions',
  'GET /hosts',
  'GET /inbox',
  'GET /inbox/unread-count',
  'POST /inbox/seen',
  'GET /notifications',
  'PATCH /notifications/:id/read',
  'POST /notifications/read-all',
  'GET /staff/dashboard/stats',
  'GET /staff/activity-feed',
  'GET /visits',
  'GET /visits/:id',
  'POST /visits/:id/rating',
  'POST /auth/switch-role',
  'POST /auth/change-password',
  'POST /auth/logout',
];

const PUBLIC_ROUTES = [
  'GET /health',
  'GET /public/desk-qr/:token',
  'GET /public/desk-qr/:token/hosts',
  'POST /public/desk-qr/:token/registrations',
  // Gate kiosk device: the kiosk link token is the credential, checked and
  // rate-limited (per IP and per link) on every call.
  'GET /public/gate/:token',
  'POST /public/gate/:token/verify',
  'POST /auth/login',
  'POST /auth/signup',
  'GET /auth/signup-available',
  'POST /auth/refresh',
  // Admin-issued reset links: the emailed single-use token is the credential;
  // both routes are rate-limited and the completion revokes every session.
  'POST /auth/reset-password/validate',
  'POST /auth/reset-password',
];

describe('route guards', () => {
  const all = routes();
  const routesWith = (access: Access) =>
    all
      .filter((r) => r.access === access)
      .map((r) => r.route)
      .sort();

  it('finds every controller route', () => {
    expect(all.length).toBeGreaterThan(80);
  });

  it('only exposes the reviewed public routes', () => {
    expect(routesWith('public')).toEqual([...PUBLIC_ROUTES].sort());
  });

  it('requires a permission on every other route except the reviewed self-service ones', () => {
    expect(routesWith('signed-in')).toEqual([...SIGNED_IN_ROUTES].sort());
  });
});
