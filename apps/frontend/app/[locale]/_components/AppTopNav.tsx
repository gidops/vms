"use client";

import { Avatar, Badge, Button, SegmentedControl, TopNav } from "@vms/ui";
import { Bell, ChevronDown, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/shared/auth/AuthContext";

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
  /** Which primary view is active. */
  active: "schedule" | "requests";
  /** Count shown on the "Requests & Alerts" pill. */
  requestsCount?: number;
}

/**
 * Shared application top bar: brand + the schedule/requests segmented control
 * (wired to routing) + user controls. Used by both the dashboard and the
 * Requests & Alerts screen so the nav stays identical and in sync.
 */
export function AppTopNav({ active, requestsCount }: AppTopNavProps) {
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <TopNav
      brand={<BrandMark />}
      center={
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
      }
      end={
        <>
          <Button
            intent="neutral"
            tone="ghost"
            size="sm"
            aria-label={tCommon("notifications")}
            className="text-emphasis-fg hover:bg-white/10"
          >
            <span className="relative">
              <Bell className="size-5" aria-hidden="true" />
              {requestsCount ? (
                <Badge
                  intent="accent"
                  tone="solid"
                  size="sm"
                  className="absolute -end-2 -top-2 size-4 justify-center p-0"
                >
                  {requestsCount}
                </Badge>
              ) : null}
            </span>
          </Button>
          <Avatar name={user?.fullName ?? "User"} size="sm" />
          <button
            type="button"
            onClick={() => void logout()}
            aria-label={tCommon("logout")}
            className="inline-flex items-center text-emphasis-fg/80 transition-colors hover:text-emphasis-fg"
          >
            <ChevronDown className="size-4" aria-hidden="true" />
            <LogOut className="ms-1 size-4" aria-hidden="true" />
          </button>
        </>
      }
    />
  );
}
