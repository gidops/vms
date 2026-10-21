import { fireEvent, screen } from "@testing-library/react";
import { PERMISSIONS } from "@vms/contracts";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import HelpPage from "./page";

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
  usePathname: () => "/help",
  useRouter: () => ({ replace }),
}));
vi.mock("@/app/[locale]/_components/EvacuationRollScreen", () => ({
  EvacuationRollScreen: () => <p>roll screen</p>,
}));
vi.mock("@/app/[locale]/_components/CommsOptInsScreen", () => ({
  CommsOptInsScreen: () => <p>opt-ins screen</p>,
}));
vi.mock("@/app/[locale]/_components/DeskQrScreen", () => ({
  DeskQrScreen: () => <p>desk qr screen</p>,
}));

const VMC = [
  PERMISSIONS.EVACUATION_READ,
  PERMISSIONS.CONSENT_READ,
  PERMISSIONS.ISSUER_READ,
  PERMISSIONS.REPORT_EXPORT,
];
const tabNames = () =>
  screen.getAllByRole("radio").map((tab) => tab.textContent);

describe("Help/Support page", () => {
  beforeEach(() => {
    perms.clear();
    query = "";
    replace.mockReset();
  });

  it("gives VMC all five tabs, opening on the Evacuation Roll", () => {
    VMC.forEach((p) => perms.add(p));
    renderWithIntl(<HelpPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Help/Support" }),
    ).toBeInTheDocument();
    expect(tabNames()).toEqual([
      "Evacuation Roll",
      "Comms Opt-ins",
      "Desk QR",
      "Export Data",
      "Help & Support",
    ]);
    expect(screen.getByText("roll screen")).toBeInTheDocument();
  });

  it("shows only Help & Support to roles without the admin permissions", () => {
    renderWithIntl(<HelpPage />);
    expect(tabNames()).toEqual(["Help & Support"]);
    expect(
      screen.getByText(/Contact the development team/),
    ).toBeInTheDocument();
  });

  it("opens the tab named in ?tab= and keeps tab changes in the URL", () => {
    VMC.forEach((p) => perms.add(p));
    query = "tab=deskQr";
    renderWithIntl(<HelpPage />);
    expect(screen.getByText("desk qr screen")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Comms Opt-ins" }));
    expect(replace).toHaveBeenCalledWith({
      pathname: "/help",
      query: { tab: "optIns" },
    });
  });

  it("falls back to the first tab when ?tab= is not allowed", () => {
    perms.add(PERMISSIONS.CONSENT_READ);
    query = "tab=deskQr";
    renderWithIntl(<HelpPage />);
    expect(screen.queryByText("desk qr screen")).toBeNull();
    expect(screen.getByText("opt-ins screen")).toBeInTheDocument();
  });

  it("opens the visitor export from the Export Data tab", () => {
    perms.add(PERMISSIONS.REPORT_EXPORT);
    query = "tab=export";
    renderWithIntl(<HelpPage />);
    fireEvent.click(screen.getByRole("button", { name: /Export Data/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Export Visitor Data");
  });
});
