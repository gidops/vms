"use client";

import { homeFor } from "@vms/contracts";
import { SegmentedControl, TopNav } from "@vms/ui";
import { useTranslations } from "next-intl";
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

export interface AppTopNavProps {
  /**
   * Primary view toggle. The VMC dashboard toggles schedule/requests; the staff
   * dashboard toggles schedule/visits/updates. Omit on dashboards with no toggle.
   */
  active?: "schedule" | "visits" | "requests" | "updates";
  /** Which app's nav segments + routes to render (default "vmc"). */
  app?: "vmc" | "staff";
  /**
   * Override the "Requests & Alerts" pill count. Defaults to the live per-user
   * unread count (scoped to the current app), so callers normally omit this.
   */
  requestsCount?: number;
  /** Static centered pill label (e.g. "Account Settings") when there's no toggle. */
  centerLabel?: string;
}

/**
 * Shared application top bar: brand + an optional primary view toggle + the
 * shared control cluster (role switcher, language, account menu). Used by every
 * dashboard so the nav stays identical and in sync. The `app` prop selects the
 * VMC (schedule/requests) or staff (schedule/visits/requests) segment set.
 */
export function AppTopNav({
  active,
  app = "vmc",
  requestsCount,
  centerLabel,
}: AppTopNavProps) {
  const tNav = useTranslations("nav");
  const router = useRouter();
  const { activeRole } = useAuth();

  // The nav bubble shows the current user's unread count; staff see their own
  // scope, the VMC sees all. An explicit `requestsCount` overrides it.
  const unreadQ = useInboxUnread("all", app === "staff" ? "mine" : "all");
  const count = requestsCount ?? unreadQ.data?.unread ?? undefined;

  const options =
    app === "staff"
      ? [
          { value: "schedule", label: tNav("schedule"), route: "/staff" },
          { value: "visits", label: tNav("myVisits"), route: "/staff/visits" },
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
        <Link
          href={homeFor(activeRole)}
          aria-label={tNav("home")}
          className="inline-flex rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          <BrandMark />
        </Link>
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
          <LanguageSwitcher />
          <AccountMenu />
        </>
      }
    />
  );
}
