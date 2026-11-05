import { fireEvent, screen } from "@testing-library/react";
import { PERMISSIONS } from "@vms/contracts";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import InsightsPage from "./page";

const perms = new Set<string>();
let query = "";
const replace = vi.fn();
vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: (p: string) => perms.has(p) }),
}));
vi.mock("@/shared/auth/RouteGuard", () => ({
  RouteGuard: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/app/[locale]/_components/AppTopNav", () => ({
  AppTopNav: () => null,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(query),
}));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/insights",
  useRouter: () => ({ replace }),
}));
vi.mock("@/app/[locale]/_components/EvacuationRollScreen", () => ({
  EvacuationRollScreen: () => <p>roll screen</p>,
}));
vi.mock("./_components/OverviewTab", () => ({
  OverviewTab: () => <p>overview tab</p>,
}));
vi.mock("./_components/HistoryTab", () => ({
  HistoryTab: () => <p>history tab</p>,
}));
vi.mock("./_components/VisitorsTab", () => ({
  VisitorsTab: () => <p>visitors tab</p>,
}));
vi.mock("./_components/AnalyticsTab", () => ({
  AnalyticsTab: () => <p>analytics tab</p>,
}));

/** Effective permissions per role (add-ons merged into their base role). */
const ROLE = {
  staff: [PERMISSIONS.INSIGHTS_SELF],
  readAdmin: [
    PERMISSIONS.INSIGHTS_SELF,
    PERMISSIONS.OVERVIEW_READ,
    PERMISSIONS.HISTORY_READ,
    PERMISSIONS.VISITOR_READ,
    PERMISSIONS.REPORT_READ,
  ],
  vmc: [PERMISSIONS.EVACUATION_READ, PERMISSIONS.HISTORY_READ],
  vmcAdmin: [
    PERMISSIONS.EVACUATION_READ,
    PERMISSIONS.HISTORY_READ,
    PERMISSIONS.VISITOR_READ,
    PERMISSIONS.REPORT_READ,
  ],
  evacuationOnly: [PERMISSIONS.EVACUATION_READ],
  securityManager: [
    PERMISSIONS.EVACUATION_READ,
    PERMISSIONS.HISTORY_READ,
    PERMISSIONS.VISITOR_READ,
    PERMISSIONS.REPORT_READ,
  ],
  systemAdmin: Object.values(PERMISSIONS),
};

const as = (role: keyof typeof ROLE) => ROLE[role].forEach((p) => perms.add(p));
const tabNames = () =>
  screen.queryAllByRole("radio").map((tab) => tab.textContent);

describe("Insights page", () => {
  beforeEach(() => {
    perms.clear();
    query = "";
    replace.mockReset();
  });

  it.each([
    ["staff", ["History", "Visitors", "Analytics"]],
    ["readAdmin", ["Overview", "History", "Visitors", "Analytics"]],
    ["vmc", ["Evacuation Roll", "History"]],
    ["vmcAdmin", ["Evacuation Roll", "History", "Visitors", "Analytics"]],
    [
      "securityManager",
      ["Evacuation Roll", "History", "Visitors", "Analytics"],
    ],
    [
      "systemAdmin",
      ["Overview", "Evacuation Roll", "History", "Visitors", "Analytics"],
    ],
  ] as const)("gives %s the right tabs", (role, expected) => {
    as(role);
    renderWithIntl(<InsightsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Insights" }),
    ).toBeInTheDocument();
    expect(tabNames()).toEqual(expected);
  });

  it("shows a single tab without a tab bar", () => {
    as("evacuationOnly");
    renderWithIntl(<InsightsPage />);
    expect(tabNames()).toEqual([]);
    expect(screen.getByText("roll screen")).toBeInTheDocument();
  });

  it("opens on the first allowed tab and ignores a forbidden ?tab=", () => {
    as("staff");
    query = "tab=overview";
    renderWithIntl(<InsightsPage />);
    expect(screen.getByText("history tab")).toBeInTheDocument();
    expect(screen.queryByText("overview tab")).not.toBeInTheDocument();
  });

  it("opens the tab named in ?tab= and keeps tab changes in the URL", () => {
    as("systemAdmin");
    query = "tab=visitors";
    renderWithIntl(<InsightsPage />);
    expect(screen.getByText("visitors tab")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Analytics" }));
    expect(replace).toHaveBeenCalledWith({
      pathname: "/insights",
      query: { tab: "analytics" },
    });
  });

  it("explains when a role has nothing to see", () => {
    renderWithIntl(<InsightsPage />);
    expect(
      screen.getByText("There is nothing to show for your role yet."),
    ).toBeInTheDocument();
  });
});
