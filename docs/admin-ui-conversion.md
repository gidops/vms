# Admin console v2: UI conversion map

The admin console (`/admin`) was originally built with its own UI: a sidebar
`SideNav`, `SectionCard` panels, `StatCard` tiles and `ActionTile` quick
actions. **Admin console v2** (`/admin/v2`) rebuilds it from the VMC and staff
dashboard components and their page structure, so all dashboards look the same:

```
nav (tabs) → filter bar → overview band (stats + green panel) → table area → charts
```

The original `/admin` screens are untouched and still live. v2 is a parallel
route tree for review. Once variants and role arrangements are chosen, the v2
screens replace the originals.

- **Live catalog:** `/admin/v2/catalog` shows every conversion below, with its
  variants rendered on live data.
- **Variants:** A is the default on each v2 screen; B is available through the
  full-page previews.

| Screen   | Variant A (default)                          | Variant B                                                 |
| -------- | -------------------------------------------- | --------------------------------------------------------- |
| Overview | `/admin/v2` (VMC layout)                     | `/admin/v2?layout=staff` (staff layout)                   |
| Requests | `/admin/v2/requests` (VMC Requests & Alerts) | `/admin/v2/requests?layout=staff` (staff My Visits table) |
| Users    | `/admin/v2/users` (dialogs)                  | `/admin/v2/users?layout=drawer` (drawer)                  |

## Navigation

The sidebar is replaced by `AppTopNav app="admin"`, the same bar VMC and staff
use. It has three tabs:

| Tab      | Route                | Notes                                                                                        |
| -------- | -------------------- | -------------------------------------------------------------------------------------------- |
| Overview | `/admin/v2`          | Stats, visitor records, charts                                                               |
| Requests | `/admin/v2/requests` | Approval queue and activity inbox merged. Carries the unread count, which replaces the bell. |
| Users    | `/admin/v2/users`    | Only shown with `user:read`                                                                  |

Settings stays in the account menu, as on the other dashboards. The disabled
or hidden sidebar items (Visitors, Watchlist, Floors, Categories, Analytics,
Integrations) can become tabs once they are built.

## Component conversions

Paths are relative to `apps/frontend/app/[locale]/`. New v2 components live in
`admin/v2/_components/`.

| #   | Original admin component                                                                     | Converted to                             | Variant A                                                                                                                                                                             | Variant B                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `AdminShell`: TopNavShell + SideNav + mobile link strip (`admin/_components/AdminShell.tsx`) | `TopNavShell` + `AppTopNav app="admin"`  | Single                                                                                                                                                                                | –                                                                                                                                                  |
| 2   | Top-nav `SearchInput` (brand slot)                                                           | Filter bar under the nav: `AdminFilters` | **Staff** `VisitFilters`: search + status/type/purpose + Search                                                                                                                       | **VMC** search-only `FilterBar` + Search                                                                                                           |
| 3   | Page header + `OverviewStats` (5 `StatCard`s)                                                | Overview band: `AdminOverview`           | **VMC** `VmcOverview`: eyebrow "Admin Console · {role}" + welcome row, stat cells, green panel                                                                                        | **Staff** `StaffOverview`: welcome + "Pending approvals: N" cell (the Office Floor slot), stat cells, green panel                                  |
| 4   | `QuickActionsCard` (`ActionTile`s)                                                           | Green panel: `AdminActionPanel`          | Single. **VMC** QuickActions / **staff** BookPanel. Add Visitor and Export are permission-gated. Roles with neither get "Review Requests" (approvers) or "View Activity" (read-only). | –                                                                                                                                                  |
| 5   | `TodaysVisitorsCard`                                                                         | `RecordTable`: `AdminVisitsTable`        | **VMC** records columns (Guest, Channel, Host/Unit, Purpose, Guests, Status, Action); **staff** My Visits header strip with Today / Upcoming / Yesterday / Pick date (scheduled date) | **Staff** schedule columns (Guest, Purpose, Guests, Status), row click opens details; Today / Last 7 days / Custom toolbar (created date)          |
| 6   | `RecentActivityCard`                                                                         | Feed card: `AdminActivityFeed`           | **Staff** `RecentUpdates` card (badge, time, name, detail, link)                                                                                                                      | **VMC** compact `InboxCard`s                                                                                                                       |
| 7   | `UpcomingCard`                                                                               | –                                        | The "Upcoming" pill of #5 A                                                                                                                                                           | **Staff** `RecentUpdates`-style card: `AdminUpcomingFeed`                                                                                          |
| 8   | `TrafficCard` + `StatusBreakdownCard`                                                        | `AdminChartsPanel`                       | Single. No VMC/staff equivalent, so restyled into the band panel language (bordered panel, primary heading, `primary-subtle` cells) and placed below the table.                       | –                                                                                                                                                  |
| 9   | `PendingRequests` (`/admin/requests`) + `/admin/activity`                                    | Requests tab                             | **VMC** `RequestsAlertsScreen app="admin"` (All / Requests / Alerts, `InboxCard` grid). Approve/deny happen in `VisitDetailSheet`.                                                    | **Staff** My Visits layout: `PendingApprovalsTable` with status pills and Review / Update actions. Pending group visits open `GroupApprovalSheet`. |
| 10  | Users page (`admin/users/page.tsx`)                                                          | Users tab                                | **Staff** My Visits layout (search + role filter bar, header strip, `RecordTable`, action column); create/edit in the existing dialogs                                                | Same table; create/edit in a **VMC** `QuickActionSheet`-style leading drawer: `UserFormDrawer`                                                     |
| 11  | `SectionCard`                                                                                | Removed                                  | Replaced by the `RecordTable` toolbar or header strip, and the feed-card frame                                                                                                        | –                                                                                                                                                  |
| 12  | Notifications bell (`notificationsHref`)                                                     | Count bubble on the Requests tab         | Single, as VMC and staff do it                                                                                                                                                        | –                                                                                                                                                  |

### Page arrangements

|            | Overview A (VMC) | Overview B (staff)                      |
| ---------- | ---------------- | --------------------------------------- |
| Filter bar | #2 A             | #2 B                                    |
| Band       | #3 A             | #3 B                                    |
| Table area | #5 A, full width | #5 B beside a feed column (#6 A + #7 B) |
| Below      | #8 charts        | #8 charts                               |

In Overview A, recent activity lives on the Requests tab, the same way VMC
keeps it on its own tab. Overview B shows it in the side column, as staff does.

## Supporting changes

- **Shared overview pieces:** `DecorChevrons` and the stat cell were duplicated
  in `VmcOverview` and `StaffOverview`. They are now shared in
  `_components/overview/` and used by both plus admin; nothing changes visually.
  The stat cell gained an optional `hint` sub-line, used for the
  vs-yesterday trend.
- **User dialogs:** moved from `admin/users/page.tsx` to
  `admin/_components/users/UserDialogs.tsx`, so the original page and v2 share
  them.
- **Permission gating:** v2 gates Users actions by `user:create`,
  `user:update` and `user:delete`. On the original page, Auditor could see the
  create/delete buttons.
- **Data:** `useAdminVisits` in `data/admin/queries.ts` drives the v2 tables.
- **i18n:** new keys are `adminV2.*`, `nav.overview` and `nav.users`, in
  en/fr/ar. The catalog page is English-only (internal review tool).

## Open choices

1. Pick A or B for #2, #3, #5, #6, #7, #9 and #10.
2. Choose an arrangement per role. Every role shares one structure today;
   widgets are only permission-gated.
   - **Admin (Security Manager):** approvals first.
   - **Super Admin:** quick actions first.
   - **Auditor:** stats and overview first, view only.
3. Once decided: move `admin/v2/*` up to `admin/*`, delete the old components
   (`AdminShell`, `SectionCard`, `OverviewStats`, the old cards) and the
   catalog, and drop the `search` / `notificationsHref` props from `AppTopNav`
   if nothing else uses them.
