"use client";

import { SegmentedControl, TopNav } from "@vms/ui";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AccountMenu } from "./AccountMenu";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { RoleSwitcher } from "./RoleSwitcher";

function BrandMark() {
  return (
    <span className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/afreximbank.svg"
        alt=""
        className="size-9"
        aria-hidden="true"
      />
      <span className="text-sm font-bold tracking-[0.2em]">AFREXIMBANK</span>
    </span>
  );
}

export interface AppTopNavProps {
  /** VMC-only primary view toggle; omit on other dashboards. */
  active?: "schedule" | "requests";
  /** Count shown on the "Requests & Alerts" pill. */
  requestsCount?: number;
}

/**
 * Shared application top bar: brand + an optional VMC schedule/requests toggle +
 * the shared control cluster (role switcher, language, account menu). Used by
 * every dashboard so the nav stays identical and in sync.
 */
export function AppTopNav({ active, requestsCount }: AppTopNavProps) {
  const tNav = useTranslations("nav");
  const router = useRouter();

  return (
    <TopNav
      brand={<BrandMark />}
      center={
        active ? (
          <SegmentedControl
            variant="onEmphasis"
            aria-label={tNav("schedule")}
            value={active}
            onValueChange={(value) =>
              router.push(value === "requests" ? "/requests" : "/dashboard")
            }
            options={[
              { value: "schedule", label: tNav("schedule") },
              {
                value: "requests",
                label: tNav("requests"),
                count: requestsCount,
              },
            ]}
          />
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
