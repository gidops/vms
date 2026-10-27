# Admin console v2

**Who this is for:** frontend developers working on the admin console, and
anyone deciding when to switch to the new one. **What you'll learn:** why two
admin consoles exist, what the new one contains, how its parts map to the old
one, and what is left before the switch.

> **Two consoles coexist until cutover.** `/admin` is the original console and
> is still where the System Admin and Security Manager land after signing in
> (`ROLE_HOME` in `@vms/contracts`). `/admin/v2` is the rebuilt console. It is
> fully working but only reachable by URL or from inside v2. Once it is signed
> off, v2 moves to `/admin` and the old screens are deleted (see
> [Cutover](#cutover)).

## Why v2

The original console used its own UI: a sidebar (`SideNav`), `SectionCard`
panels and stat tiles. v2 rebuilds it from the components and page structure of
the VMC and staff dashboards, so every dashboard looks and behaves the same:

```
top nav (tabs) → filter bar → overview band (stats + green action panel) → table area + feed
```

## What v2 contains

The sidebar is replaced by `AppTopNav app="admin"`, the same bar VMC and staff
use. Settings, Insights and Operations stay in the account menu.

| Tab                   | Route                 | Shown to                                               | Contents                                                                                                                                                          |
| --------------------- | --------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overview**          | `/admin/v2`           | Everyone in the admin console                          | Role-aware band ("Admin Console · {role}", stats, action panel). Security Manager: pending-approvals table. System Admin: Visitor Records. Both: an updates feed. |
| **Pending Approvals** | `/admin/v2/approvals` | Security Manager (`visit:approve` without `user:read`) | Full approval queue, filterable by Awaiting approval / Info requested, with **Review**.                                                                           |
| **Recent Activity**   | `/admin/v2/requests`  | Everyone; shows the unread count                       | The Requests & Alerts feed. `?layout=staff` shows the pending-approvals table instead.                                                                            |
| **Users**             | `/admin/v2/users`     | `user:read` (System Admin)                             | User table; create/edit in dialogs, or in a side drawer with `?layout=drawer`. Actions gated by `user:create`, `user:update`, `user:delete`.                      |

Analytics, the evacuation roll and email opt-ins moved to **Insights**
(`/insights`); the walk-in QR moved to **Operations** (`/operations`). The v2
console has no tabs for them.

Which console a user gets is decided from permissions, not the role name
(`shared/auth/adminConsoleRole.ts`): `visit:approve` without `user:read` means
Security Manager; anything else means System Admin.

## Component map (old → new)

Paths are relative to `apps/frontend/app/[locale]/`. v2 components live in
`admin/v2/_components/`.

| Original (`/admin`)                                           | v2 replacement                                                                                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `AdminShell` (top nav + `SideNav`)                            | `TopNavShell` + `AppTopNav app="admin"`                                                                                       |
| Top-nav `SearchInput`                                         | `AdminFilters` filter bar under the nav                                                                                       |
| `AdminOverviewBar`                                            | `AdminOverview` band, data from `useAdminBand`                                                                                |
| Quick actions                                                 | `AdminActionPanel` (Add Visitor and Export gated by permission)                                                               |
| `TodaysVisitorsCard`                                          | `AdminVisitsTable` (on `RecordTable`)                                                                                         |
| `PendingApprovalsCard`, `PendingRequests` (`/admin/requests`) | `PendingApprovalsTable` (Overview and Pending Approvals tab); groups open `GroupApprovalSheet`                                |
| `RecentActivityCard`, `/admin/activity`                       | `AdminActivityFeed` and the Recent Activity tab                                                                               |
| `admin/users/page.tsx`                                        | Users tab; dialogs shared from `admin/_components/users/UserDialogs.tsx`, drawer in `v2/_components/users/UserFormDrawer.tsx` |
| Notifications bell (`notificationsHref`)                      | Count bubble on the Recent Activity tab                                                                                       |
| `SectionCard`                                                 | Removed: replaced by the `RecordTable` toolbar and feed-card frame                                                            |

Shared pieces: the overview band building blocks (stat cells, `DecorChevrons`)
live in `_components/OverviewBar.tsx` and are reused across dashboards. Data for the v2 tables comes from `useAdminVisits` in `data/admin/queries.ts`.
Translation keys are under `adminV2.*` and `nav.*` in en/fr/ar.

## Cutover

1. Move `admin/v2/*` up to `admin/*` and point `AppTopNav`'s admin routes at
   `/admin/...`.
2. Delete the old components: `AdminShell`, `SectionCard`, `AdminOverviewBar`,
   `PendingApprovalsCard`, `PendingRequests`, `RecentActivityCard`,
   `TodaysVisitorsCard`, `adminAccess.ts`, and the `/admin/activity` and
   `/admin/requests` pages.
3. Drop the `search` and `notificationsHref` props from `AppTopNav` if nothing
   else uses them, and `SideNav` from `@vms/ui` if unused.
4. Decide whether to keep the `?layout=` alternatives on Recent Activity and
   Users, or remove them.
