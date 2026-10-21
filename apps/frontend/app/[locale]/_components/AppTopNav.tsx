"use client";

import { homeFor, PERMISSIONS } from "@vms/contracts";
import { SegmentedControl, TopNav } from "@vms/ui";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import type * as React from "react";
import { useInboxUnread } from "@/data/requests/queries";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";
import { AccountMenu } from "./AccountMenu";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { RoleSwitcher } from "./RoleSwitcher";

function BrandMark() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/afreximbank.svg" alt="AATC VMS" className="size-9" />
  );
}

/** Admin console tabs after Overview · Requests, in display order. */
const ADMIN_TABS = [
  {
    value: "users",
    route: "/admin/v2/users",
    permission: PERMISSIONS.USER_READ,
  },
  {
    value: "analytics",
    route: "/admin/v2/analytics",
    permission: PERMISSIONS.REPORT_READ,
  },
  {
    value: "evacuation",
    route: "/admin/v2/evacuation",
    permission: PERMISSIONS.EVACUATION_READ,
  },
  {
    value: "optIns",
    route: "/admin/v2/opt-ins",
    permission: PERMISSIONS.CONSENT_READ,
  },
  {
    value: "deskQr",
    route: "/admin/v2/desk-qr",
    permission: PERMISSIONS.ISSUER_READ,
  },
] as const;

export interface AppTopNavProps {
  /**
   * Primary view toggle. The VMC dashboard toggles schedule/requests; the staff
   * dashboard toggles schedule/visits/updates; the admin console toggles
   * overview/requests plus the permission-gated users, analytics, evacuation,
   * opt-ins and desk QR tabs. Omit on dashboards with no toggle.
   */
  active?:
    | "schedule"
    | "visits"
    | "requests"
    | "updates"
    | "overview"
    | "users"
    | "analytics"
    | "evacuation"
    | "optIns"
    | "deskQr";
  /** Which app's nav segments + routes to render (default "vmc"). */
  app?: "vmc" | "staff" | "admin";
  /**
   * Override the "Requests & Alerts" pill count. Defaults to the live per-user
   * unread count (scoped to the current app), so callers normally omit this.
   */
  requestsCount?: number;
  /** Static centered pill label (e.g. "Account Settings") when there's no toggle. */
  centerLabel?: string;
  /** Global search field rendered beside the brand (admin console). */
  search?: React.ReactNode;
  /**
   * Show a notifications bell (with the unread count) linking here. Used by
   * consoles without the Requests & Alerts toggle.
   */
  notificationsHref?: string;
}

/**
 * Shared application top bar: brand + an optional primary view toggle + the
 * shared control cluster (role switcher, language, account menu). Used by every
 * dashboard so the nav stays identical and in sync. The `app` prop selects the
 * VMC (schedule/requests), staff (schedule/visits/updates) or admin
 * (overview/requests/users) segment set.
 */
export function AppTopNav({
  active,
  app = "vmc",
  requestsCount,
  centerLabel,
  search,
  notificationsHref,
}: AppTopNavProps) {
  const tNav = useTranslations("nav");
  const router = useRouter();
  const { activeRole, hasPermission } = useAuth();

  // The nav bubble shows the current user's unread count; staff see their own
  // scope, the VMC sees all. An explicit `requestsCount` overrides it.
  const unreadQ = useInboxUnread("all", app === "staff" ? "mine" : "all");
  const count = requestsCount ?? unreadQ.data?.unread ?? undefined;

  const options =
    app === "admin"
      ? [
          { value: "overview", label: tNav("overview"), route: "/admin/v2" },
          {
            value: "requests",
            label: tNav("requests"),
            route: "/admin/v2/requests",
            count,
          },
          // Each further tab only for roles that hold its permission.
          ...ADMIN_TABS.filter((tab) => hasPermission(tab.permission)).map(
            (tab) => ({
              value: tab.value,
              label: tNav(tab.value),
              route: tab.route,
            }),
          ),
        ]
      : app === "staff"
        ? [
            { value: "schedule", label: tNav("schedule"), route: "/staff" },
            {
              value: "visits",
              label: tNav("myVisits"),
              route: "/staff/visits",
            },
            {
              value: "updates",
              label: tNav("updates"),
              route: "/staff/updates",
              count,
            },
          ]
        : [
            { value: "schedule", label: tNav("schedule"), route: "/dashboard" },
            {
              value: "requests",
              label: tNav("requests"),
              route: "/requests",
              count,
            },
          ];

  return (
    <TopNav
      brand={
        <div className="flex min-w-0 flex-1 items-center gap-8">
          <Link
            href={homeFor(activeRole)}
            aria-label={tNav("home")}
            className="inline-flex shrink-0 rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            <BrandMark />
          </Link>
          {search ? (
            <div className="hidden w-full max-w-xl md:block">{search}</div>
          ) : null}
        </div>
      }
      center={
        active ? (
          <SegmentedControl
            variant="onEmphasis"
            aria-label={tNav("schedule")}
            value={active}
            onValueChange={(value) => {
              const target = options.find((o) => o.value === value);
              if (target) router.push(target.route);
            }}
            options={options.map(({ value, label, count }) => ({
              value,
              label,
              count,
            }))}
          />
        ) : centerLabel ? (
          <span className="inline-flex items-center rounded-full border border-accent px-4 py-1.5 text-sm font-medium text-emphasis-fg">
            {centerLabel}
          </span>
        ) : undefined
      }
      end={
        <>
          <RoleSwitcher />
          {notificationsHref ? (
            <Link
              href={notificationsHref}
              aria-label={
                count
                  ? tNav("notificationsUnread", { count })
                  : tNav("notifications")
              }
              className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-emphasis-fg/10 text-emphasis-fg outline-none transition-colors hover:bg-emphasis-fg/20 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <Bell className="size-5" aria-hidden="true" />
              {count ? (
                <span
                  className="absolute -end-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-semibold leading-4 text-accent-fg"
                  aria-hidden="true"
                >
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
            </Link>
          ) : null}
          <LanguageSwitcher />
          <AccountMenu />
        </>
      }
    />
  );
}
