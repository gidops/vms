import { fireEvent, screen, within } from "@testing-library/react";
import { PERMISSIONS } from "@vms/contracts";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { AppTopNav } from "./AppTopNav";

const perms = new Set<string>();
const push = vi.fn();
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
  useRouter: () => ({ push }),
}));
vi.mock("./AccountMenu", () => ({ AccountMenu: () => null }));
vi.mock("./LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));
vi.mock("./RoleSwitcher", () => ({ RoleSwitcher: () => null }));

const tabs = () =>
  screen.getAllByRole("radio").map((r) => r.textContent?.trim());

describe("AppTopNav — admin console tabs", () => {
  beforeEach(() => {
    perms.clear();
    push.mockReset();
  });

  it("always shows Overview and Recent Activity", () => {
    renderWithIntl(<AppTopNav app="admin" active="overview" />);
    expect(tabs()).toEqual(["Overview", "Recent Activity"]);
  });

  it("adds no tab for Insights / Operations permissions", () => {
    // Analytics, evacuation and opt-ins live on Insights; the desk QR on Operations.
    perms.add(PERMISSIONS.REPORT_READ);
    perms.add(PERMISSIONS.EVACUATION_READ);
    perms.add(PERMISSIONS.CONSENT_READ);
    perms.add(PERMISSIONS.ISSUER_READ);
    renderWithIntl(<AppTopNav app="admin" active="overview" />);
    expect(tabs()).toEqual(["Overview", "Recent Activity"]);
  });

  it("gives the System Admin Overview · Recent Activity · Users", () => {
    for (const p of Object.values(PERMISSIONS)) perms.add(p);
    renderWithIntl(<AppTopNav app="admin" active="users" />);
    expect(tabs()).toEqual(["Overview", "Recent Activity", "Users"]);
  });

  it("gives the Security Manager Overview · Pending Approvals · Recent Activity", () => {
    perms.add(PERMISSIONS.VISIT_APPROVE);
    perms.add(PERMISSIONS.REPORT_READ);
    renderWithIntl(<AppTopNav app="admin" active="overview" />);
    expect(tabs()).toEqual([
      "Overview",
      "Pending Approvals",
      "Recent Activity",
    ]);
    fireEvent.click(screen.getByRole("radio", { name: "Pending Approvals" }));
    expect(push).toHaveBeenCalledWith("/admin/approvals");
  });

  it("mirrors the tabs as bottom-bar links with short labels", () => {
    perms.add(PERMISSIONS.VISIT_APPROVE);
    renderWithIntl(<AppTopNav app="admin" active="approvals" />);
    const bar = screen.getByRole("navigation", { name: "Sections" });
    const links = within(bar).getAllByRole("link");
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Overview", "/admin"],
      ["Approvals", "/admin/approvals"],
      ["Activity", "/admin/requests"],
    ]);
    expect(links[1]).toHaveAttribute("aria-current", "page");
  });
});
