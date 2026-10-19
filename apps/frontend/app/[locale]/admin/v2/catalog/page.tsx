"use client";

import { Badge, Button, TopNavShell } from "@vms/ui";
import { ExternalLink } from "lucide-react";
import type * as React from "react";
import { AppTopNav } from "@/app/[locale]/_components/AppTopNav";
import { Link } from "@/i18n/navigation";
import { RouteGuard } from "@/shared/auth/RouteGuard";
import { AdminActionPanel } from "../_components/AdminActionPanel";
import { AdminActivityFeed } from "../_components/AdminActivityFeed";
import { AdminChartsPanel } from "../_components/AdminChartsPanel";
import { AdminFilters, useAdminFilters } from "../_components/AdminFilters";
import { AdminOverview } from "../_components/AdminOverview";
import { AdminUpcomingFeed } from "../_components/AdminUpcomingFeed";
import { AdminVisitsTable } from "../_components/AdminVisitsTable";
import { PendingApprovalsTable } from "../_components/PendingApprovalsTable";
import { useAdminBand } from "../_components/useAdminBand";
import { useVisitOverlays } from "../_components/VisitOverlays";

/*
 * Internal review page: every admin component next to its VMC/staff
 * conversion and variants, rendered live. English-only on purpose — it is a
 * design-review tool, removed once the variants are chosen (see
 * docs/admin-ui-conversion.md).
 */

type Source = "VMC" | "Staff" | "VMC + Staff";

function Entry({
  n,
  original,
  originalPath,
  converted,
  children,
}: {
  n: number;
  original: string;
  originalPath: string;
  converted: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`c${n}`}
      className="flex scroll-mt-24 flex-col gap-4 rounded-xl border border-border bg-surface p-6 shadow-xs"
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-primary">
          #{n} — {original} → {converted}
        </h2>
        <code className="text-xs text-fg-muted">{originalPath}</code>
      </header>
      {children}
    </section>
  );
}

function Variant({
  label,
  source,
  note,
  children,
}: {
  label: string;
  source: Source;
  note: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-dashed border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge intent="primary" tone="solid">
          {label}
        </Badge>
        <Badge intent="info" tone="soft">
          source: {source}
        </Badge>
        <span className="text-sm text-fg-muted">{note}</span>
      </div>
      {children}
    </div>
  );
}

function PageLink({ href, children }: { href: string; children: string }) {
  return (
    <Button asChild intent="neutral" tone="outline" size="sm">
      <Link href={href}>
        {children}
        <ExternalLink className="size-4" aria-hidden="true" />
      </Link>
    </Button>
  );
}

function Catalog() {
  const band = useAdminBand();
  const filtersA = useAdminFilters();
  const filtersB = useAdminFilters();
  const { openRow, open, overlays } = useVisitOverlays();
  const noop = () => undefined;

  const bandProps = {
    eyebrow: band.eyebrow,
    welcome: band.welcome,
    stats: band.stats,
    pendingCount: band.pendingCount,
    panel: <AdminActionPanel onAddVisitor={noop} />,
  };

  return (
    <TopNavShell
      nav={<AppTopNav app="admin" centerLabel="Admin UI — Component Catalog" />}
    >
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold text-fg">
            Admin console v2 — component conversions
          </h1>
          <p className="max-w-3xl text-fg-muted">
            Each admin component below is mapped to the VMC / staff component
            that replaces it. Where more than one fits, variants A and B are
            both rendered with live data. A is what the v2 screens use by
            default; B is reachable via the full-page previews.
          </p>
          <div className="flex flex-wrap gap-2">
            <PageLink href="/admin/v2">Overview A (VMC layout)</PageLink>
            <PageLink href="/admin/v2?layout=staff">
              Overview B (staff layout)
            </PageLink>
            <PageLink href="/admin/v2/requests">Requests A (VMC)</PageLink>
            <PageLink href="/admin/v2/requests?layout=staff">
              Requests B (staff table)
            </PageLink>
            <PageLink href="/admin/v2/users">Users A (dialogs)</PageLink>
            <PageLink href="/admin/v2/users?layout=drawer">
              Users B (drawer)
            </PageLink>
            <PageLink href="/admin">Original admin</PageLink>
          </div>
        </header>

        <Entry
          n={1}
          original="AdminShell (sidebar + mobile strip)"
          originalPath="admin/_components/AdminShell.tsx"
          converted='TopNavShell + AppTopNav app="admin"'
        >
          <Variant
            label="Single"
            source="VMC + Staff"
            note="Sidebar removed. Tabs: Overview · Requests (unread count, replaces the bell) · Users (user:read only)."
          >
            <div className="overflow-hidden rounded-lg">
              <AppTopNav app="admin" active="overview" />
            </div>
          </Variant>
        </Entry>

        <Entry
          n={2}
          original="Top-nav SearchInput"
          originalPath="admin/page.tsx (AdminShell search slot)"
          converted="Filter bar under the nav"
        >
          <Variant
            label="A"
            source="Staff"
            note="Staff VisitFilters: search + status / type / purpose + Search."
          >
            <AdminFilters
              variant="full"
              value={filtersA.filters}
              onChange={filtersA.onChange}
              onSearch={filtersA.onSearch}
            />
          </Variant>
          <Variant
            label="B"
            source="VMC"
            note="Search-only FilterBar with the VMC Search action."
          >
            <AdminFilters
              variant="search"
              value={filtersB.filters}
              onChange={filtersB.onChange}
              onSearch={filtersB.onSearch}
            />
          </Variant>
        </Entry>

        <Entry
          n={3}
          original="Page header + OverviewStats (5 StatCards)"
          originalPath="admin/_components/OverviewStats.tsx"
          converted="Overview band"
        >
          <Variant
            label="A"
            source="VMC"
            note="VmcOverview: eyebrow + welcome row, stat cells, green panel."
          >
            <AdminOverview variant="vmc" {...bandProps} />
          </Variant>
          <Variant
            label="B"
            source="Staff"
            note="StaffOverview: welcome + 'Pending approvals' cell (Office Floor slot), stat cells, green panel."
          >
            <AdminOverview variant="staff" {...bandProps} />
          </Variant>
        </Entry>

        <Entry
          n={4}
          original="QuickActionsCard (ActionTiles)"
          originalPath="admin/_components/QuickActionsCard.tsx"
          converted="Green emphasis panel"
        >
          <Variant
            label="Single"
            source="VMC + Staff"
            note="VMC QuickActions / staff BookPanel. Permission-gated buttons; roles with none get a Review Requests / View Activity CTA."
          >
            <div className="relative flex max-w-md flex-col justify-between gap-6 overflow-hidden rounded-xl bg-emphasis p-6 text-emphasis-fg">
              <AdminActionPanel onAddVisitor={noop} />
            </div>
          </Variant>
        </Entry>

        <Entry
          n={5}
          original="TodaysVisitorsCard"
          originalPath="admin/_components/TodaysVisitorsCard.tsx"
          converted="RecordTable"
        >
          <Variant
            label="A"
            source="VMC"
            note="VMC records columns + action button; My Visits header strip with Today / Upcoming / Yesterday / Pick date."
          >
            <AdminVisitsTable
              columns="vmc"
              range="myVisits"
              query={{}}
              onOpen={openRow}
            />
          </Variant>
          <Variant
            label="B"
            source="Staff"
            note="Staff schedule columns, whole row opens details; Today / Last 7 days / Custom toolbar."
          >
            <AdminVisitsTable
              columns="staff"
              range="staff"
              query={{}}
              onOpen={openRow}
            />
          </Variant>
        </Entry>

        <Entry
          n={6}
          original="RecentActivityCard"
          originalPath="admin/_components/RecentActivityCard.tsx"
          converted="Feed column card"
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Variant label="A" source="Staff" note="Staff RecentUpdates card.">
              <AdminActivityFeed variant="updates" onSelect={open} />
            </Variant>
            <Variant
              label="B"
              source="VMC"
              note="Compact InboxCards (Requests & Alerts)."
            >
              <AdminActivityFeed variant="inbox" onSelect={open} />
            </Variant>
          </div>
        </Entry>

        <Entry
          n={7}
          original="UpcomingCard"
          originalPath="admin/_components/UpcomingCard.tsx"
          converted="Upcoming range pill / feed card"
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Variant
              label="A"
              source="Staff"
              note="Folded into the table: the 'Upcoming' pill of #5 A (staff My Visits range)."
            />
            <Variant
              label="B"
              source="Staff"
              note="Second feed card in the RecentUpdates style."
            >
              <AdminUpcomingFeed
                onView={(id) => open({ kind: "request", id })}
              />
            </Variant>
          </div>
        </Entry>

        <Entry
          n={8}
          original="TrafficCard + StatusBreakdownCard"
          originalPath="admin/_components/TrafficCard.tsx, StatusBreakdownCard.tsx"
          converted="Charts panel"
        >
          <Variant
            label="Single"
            source="VMC + Staff"
            note="No VMC/staff equivalent; restyled into the band/table panel language and placed below the table."
          >
            <AdminChartsPanel stats={band.query.data} />
          </Variant>
        </Entry>

        <Entry
          n={9}
          original="PendingRequests + /admin/activity"
          originalPath="admin/_components/PendingRequests.tsx, admin/activity/page.tsx"
          converted="Requests tab"
        >
          <Variant
            label="A"
            source="VMC"
            note="VMC Requests & Alerts (All / Requests / Alerts, InboxCard grid). Full screen only."
          >
            <div>
              <PageLink href="/admin/v2/requests">Open Requests A</PageLink>
            </div>
          </Variant>
          <Variant
            label="B"
            source="Staff"
            note="Staff My Visits layout: status pills + table with Review / Update action."
          >
            <PendingApprovalsTable query={{}} onOpen={openRow} />
          </Variant>
        </Entry>

        <Entry
          n={10}
          original="Users page"
          originalPath="admin/users/page.tsx"
          converted="Users tab"
        >
          <Variant
            label="A"
            source="Staff"
            note="My Visits layout (filter bar, header strip, RecordTable, action column); create/edit in the existing dialogs."
          >
            <div>
              <PageLink href="/admin/v2/users">Open Users A</PageLink>
            </div>
          </Variant>
          <Variant
            label="B"
            source="VMC"
            note="Same table; create/edit in a QuickActionSheet-style leading drawer."
          >
            <div>
              <PageLink href="/admin/v2/users?layout=drawer">
                Open Users B
              </PageLink>
            </div>
          </Variant>
        </Entry>

        <Entry
          n={11}
          original="SectionCard"
          originalPath="admin/_components/SectionCard.tsx"
          converted="Removed"
        >
          <Variant
            label="—"
            source="VMC + Staff"
            note="Replaced by the RecordTable toolbar / header strip and the RecentUpdates feed-card frame."
          />
        </Entry>

        <Entry
          n={12}
          original="Notifications bell"
          originalPath="_components/AppTopNav.tsx (notificationsHref)"
          converted="Count on the Requests tab"
        >
          <Variant
            label="Single"
            source="VMC + Staff"
            note="Same as VMC 'Requests & Alerts' / staff 'Updates' — see #1."
          />
        </Entry>
      </div>
      {overlays}
    </TopNavShell>
  );
}

export default function AdminV2CatalogPage() {
  return (
    <RouteGuard home="/admin">
      <Catalog />
    </RouteGuard>
  );
}
