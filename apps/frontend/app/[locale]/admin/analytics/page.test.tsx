import { screen } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_PERMISSIONS, ADMIN_SECTIONS } from "../_components/adminAccess";
import { renderWithIntl } from "@/test/render";
import AdminAnalyticsPage from "./page";

const perms = new Set<string>();
vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: (p: string) => perms.has(p) }),
}));
vi.mock("@/shared/auth/RouteGuard", () => ({
  RouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/app/[locale]/admin/_components/AdminShell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/app/[locale]/admin/_components/TrafficCard", () => ({
  TrafficCard: () => <section>traffic-card</section>,
}));
vi.mock("@/app/[locale]/admin/_components/StatusBreakdownCard", () => ({
  StatusBreakdownCard: () => <section>breakdown-card</section>,
}));
vi.mock("@/app/[locale]/admin/_components/UpcomingCard", () => ({
  UpcomingCard: () => <section>upcoming-card</section>,
}));
vi.mock("@/data/admin/queries", () => ({
  useAdminOverviewStats: () => ({
    isError: false,
    data: {
      visitorsToday: 64,
      visitorsYesterday: 55,
      expected: 41,
      pending: 7,
      reviewRequested: 1,
      onsite: 23,
      checkedOutToday: 38,
      checkedInToday: 61,
      deniedToday: 5,
    },
  }),
}));

describe("/admin/analytics", () => {
  beforeEach(() => perms.clear());

  it("is gated by report:read", () => {
    renderWithIntl(<AdminAnalyticsPage />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("traffic-card")).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Analytics & Reports" }),
    ).toBeNull();
  });

  it("shows the moved trend cards and KPIs to report:read holders", () => {
    perms.add(ADMIN_PERMISSIONS.REPORT_READ);
    renderWithIntl(<AdminAnalyticsPage />);
    expect(
      screen.getByRole("heading", { name: "Analytics & Reports" }),
    ).toBeInTheDocument();
    expect(screen.getByText("traffic-card")).toBeInTheDocument();
    expect(screen.getByText("breakdown-card")).toBeInTheDocument();
    expect(screen.getByText("upcoming-card")).toBeInTheDocument();
    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.getByText("38")).toBeInTheDocument();
    // Export only with report:export.
    expect(screen.queryByRole("button", { name: /Export CSV/ })).toBeNull();
  });

  it("offers Export CSV with report:export", () => {
    perms.add(ADMIN_PERMISSIONS.REPORT_READ);
    perms.add(ADMIN_PERMISSIONS.REPORT_EXPORT);
    renderWithIntl(<AdminAnalyticsPage />);
    expect(
      screen.getByRole("button", { name: /Export CSV/ }),
    ).toBeInTheDocument();
  });

  it("links the sidebar Analytics item, gated by report:read", () => {
    const item = ADMIN_SECTIONS.find((s) => s.key === "analytics");
    expect(item).toMatchObject({
      href: "/admin/analytics",
      permission: "report:read",
    });
  });
});
