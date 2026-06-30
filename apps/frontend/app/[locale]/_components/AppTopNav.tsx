"use client";

import { SegmentedControl, TopNav } from "@vms/ui";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AccountMenu } from "./AccountMenu";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { AppSwitcher } from "./AppSwitcher";

function BrandMark() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/afreximbank.svg" alt="AATC VMS" className="size-9" />
  );
}

export interface AppTopNavProps {
  /**
   * Primary view toggle. The VMC dashboard toggles schedule/requests; the staff
   * dashboard adds "visits". Omit on dashboards with no toggle.
   */
  active?: "schedule" | "visits" | "requests";
  /** Which app's nav segments + routes to render (default "vmc"). */
  app?: "vmc" | "staff";
  /** Count shown on the "Requests & Alerts" pill. */
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

  const options =
    app === "staff"
      ? [
          { value: "schedule", label: tNav("schedule"), route: "/staff" },
          { value: "visits", label: tNav("myVisits"), route: "/staff/visits" },
          {
            value: "requests",
            label: tNav("updates"),
            route: "/staff/requests",
            count: requestsCount,
          },
        ]
      : [
          { value: "schedule", label: tNav("schedule"), route: "/dashboard" },
          {
            value: "requests",
            label: tNav("requests"),
            route: "/requests",
            count: requestsCount,
          },
        ];

  return (
    <TopNav
      brand={<BrandMark />}
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
          <AppSwitcher />
          <LanguageSwitcher />
          <AccountMenu />
        </>
      }
    />
  );
}
