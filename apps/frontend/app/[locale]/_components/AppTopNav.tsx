"use client";

import { homeFor, PERMISSIONS } from "@vms/contracts";
import { SegmentedControl, TopNav } from "@vms/ui";
import {
  Activity,
  Bell,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type * as React from "react";
import { useInboxUnread } from "@/data/requests/queries";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";
import { adminConsoleRole } from "@/shared/auth/adminConsoleRole";
import { AccountMenu } from "./AccountMenu";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileTabBar } from "./MobileTabBar";
import { RoleSwitcher } from "./RoleSwitcher";

function BrandMark() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/afreximbank.svg"
      alt="AATC VMS"
      className="size-9 md:size-12"
    />
  );
}

export interface AppTopNavProps {
  active?:
    | "schedule"
    | "visits"
    | "requests"
    | "approvals"
    | "updates"
    | "overview"
    | "users";
  app?: "vmc" | "staff" | "admin";
  /** Overrides the live per-user unread count. */
  requestsCount?: number;
  /** Centered pill label when there's no toggle. */
  centerLabel?: string;
  search?: React.ReactNode;
  /** Bell link for consoles without the Requests & Alerts toggle. */
  notificationsHref?: string;
}

/** Shared top bar: brand, optional view toggle and the account controls. */
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
  const securityManager = adminConsoleRole(hasPermission) === "securityManager";

  // Staff see their own unread scope; the VMC sees all. Only fetched when a
  // tab or the bell shows it.
  const unreadQ = useInboxUnread(
    "all",
    app === "staff" ? "mine" : "all",
    requestsCount === undefined && (!!active || !!notificationsHref),
  );
  const count = requestsCount ?? unreadQ.data?.unread ?? undefined;

  const options: {
    value: string;
    label: string;
    /** Bottom tab bar label on small screens: shorter, and every role's home tab reads Overview. */
    shortLabel?: string;
    icon: LucideIcon;
    route: string;
    count?: number;
  }[] =
    app === "admin"
      ? [
          {
            value: "overview",
            label: tNav("overview"),
            icon: LayoutDashboard,
            route: "/admin",
          },
          // The Security Manager's work queue comes before the activity feed.
          ...(securityManager
            ? [
                {
                  value: "approvals",
                  label: tNav("pendingApprovals"),
                  shortLabel: tNav("approvalsShort"),
                  icon: ShieldCheck,
                  route: "/admin/approvals",
                },
              ]
            : []),
          {
            value: "requests",
            label: tNav("recentActivity"),
            shortLabel: tNav("activityShort"),
            icon: Activity,
            route: "/admin/requests",
            count,
          },
          ...(hasPermission(PERMISSIONS.USER_READ)
            ? [
                {
                  value: "users",
                  label: tNav("users"),
                  icon: Users,
                  route: "/admin/users",
                },
              ]
            : []),
        ]
      : app === "staff"
        ? [
            {
              value: "schedule",
              label: tNav("schedule"),
              shortLabel: tNav("overview"),
              icon: LayoutDashboard,
              route: "/staff",
            },
            {
              value: "visits",
              label: tNav("myVisits"),
              icon: ClipboardList,
              route: "/staff/visits",
            },
            {
              value: "updates",
              label: tNav("updates"),
              icon: Bell,
              route: "/staff/updates",
              count,
            },
          ]
        : [
            {
              value: "schedule",
              label: tNav("schedule"),
              shortLabel: tNav("overview"),
              icon: LayoutDashboard,
              route: "/dashboard",
            },
            {
              value: "requests",
              label: tNav("requests"),
              icon: Inbox,
              route: "/requests",
              count,
            },
          ];

  return (
    <>
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
            <span className="inline-flex items-center rounded-full border-2 border-accent px-4 py-1.5 text-sm font-medium text-emphasis-fg">
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
                className="relative hidden size-10 shrink-0 items-center justify-center rounded-full bg-emphasis-fg/10 text-emphasis-fg outline-none transition-colors hover:bg-emphasis-fg/20 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] md:inline-flex"
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
      {active ? (
        <MobileTabBar
          aria-label={tNav("sections")}
          active={active}
          tabs={options.map(
            ({ value, label, shortLabel, icon, route, count }) => ({
              value,
              label: shortLabel ?? label,
              icon,
              href: route,
              count,
            }),
          )}
        />
      ) : null}
    </>
  );
}
