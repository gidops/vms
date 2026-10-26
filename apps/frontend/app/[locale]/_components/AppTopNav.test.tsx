import { screen } from "@testing-library/react";
import { PERMISSIONS } from "@vms/contracts";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { AppTopNav } from "./AppTopNav";

const perms = new Set<string>();
vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({
    activeRole: "ADMIN",
    hasPermission: (p: string) => perms.has(p),
  }),
}));
vi.mock("@/data/requests/queries", () => ({
  useInboxUnread: () => ({ data: undefined }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("./AccountMenu", () => ({ AccountMenu: () => null }));
vi.mock("./LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));
vi.mock("./RoleSwitcher", () => ({ RoleSwitcher: () => null }));

const tabs = () =>
  screen.getAllByRole("radio").map((r) => r.textContent?.trim());

describe("AppTopNav — admin console tabs", () => {
  beforeEach(() => perms.clear());

  it("always shows Overview and Requests", () => {
    renderWithIntl(<AppTopNav app="admin" active="overview" />);
    expect(tabs()).toEqual(["Overview", "Requests & Alerts"]);
  });

  it("adds each further tab only with its permission", () => {
    // Analytics, evacuation and opt-ins moved to Insights; they never show here.
    perms.add(PERMISSIONS.REPORT_READ);
    perms.add(PERMISSIONS.EVACUATION_READ);
    perms.add(PERMISSIONS.CONSENT_READ);
    perms.add(PERMISSIONS.ISSUER_READ);
    renderWithIntl(<AppTopNav app="admin" active="deskQr" />);
    expect(tabs()).toEqual(["Overview", "Requests & Alerts", "Desk QR"]);
  });

  it("shows Users first among the gated tabs", () => {
    perms.add(PERMISSIONS.USER_READ);
    perms.add(PERMISSIONS.REPORT_READ);
    renderWithIntl(<AppTopNav app="admin" active="users" />);
    expect(tabs()).toEqual(["Overview", "Requests & Alerts", "Users"]);
  });
});
