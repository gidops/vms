import { fireEvent, screen } from "@testing-library/react";
import { PERMISSIONS } from "@vms/contracts";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import OperationsPage from "./page";

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
  usePathname: () => "/operations",
  useRouter: () => ({ replace }),
}));
vi.mock("@/app/[locale]/_components/DeskQrScreen", () => ({
  DeskQrScreen: () => <p>desk qr screen</p>,
}));
vi.mock("./_components/access-cards/AccessCardsTab", () => ({
  AccessCardsTab: () => <p>access cards tab</p>,
}));
vi.mock("./_components/AuditTrailTab", () => ({
  AuditTrailTab: () => <p>audit tab</p>,
}));

const tabNames = () =>
  screen.queryAllByRole("radio").map((tab) => tab.textContent);

describe("Operations page", () => {
  beforeEach(() => {
    perms.clear();
    query = "";
    replace.mockReset();
  });

  it("gives the System Admin all three tabs, opening on Access cards", () => {
    Object.values(PERMISSIONS).forEach((p) => perms.add(p));
    renderWithIntl(<OperationsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Operations" }),
    ).toBeInTheDocument();
    expect(tabNames()).toEqual(["Access cards", "Walk-in QR", "Audit trail"]);
    expect(screen.getByText("access cards tab")).toBeInTheDocument();
  });

  it("opens ?tab= and keeps tab changes in the URL", () => {
    Object.values(PERMISSIONS).forEach((p) => perms.add(p));
    query = "tab=deskQr";
    renderWithIntl(<OperationsPage />);
    expect(screen.getByText("desk qr screen")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Audit trail" }));
    expect(replace).toHaveBeenCalledWith({
      pathname: "/operations",
      query: { tab: "audit" },
    });
  });

  it("shows nothing to a Security Manager", () => {
    [
      PERMISSIONS.USER_READ,
      PERMISSIONS.VISIT_READ,
      PERMISSIONS.REPORT_READ,
      PERMISSIONS.EVACUATION_READ,
    ].forEach((p) => perms.add(p));
    renderWithIntl(<OperationsPage />);
    expect(tabNames()).toEqual([]);
    expect(
      screen.getByText("Operations is for System Admins."),
    ).toBeInTheDocument();
  });
});
