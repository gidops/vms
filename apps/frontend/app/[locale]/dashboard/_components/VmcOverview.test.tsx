import { fireEvent, screen } from "@testing-library/react";
import { PERMISSIONS } from "@vms/contracts";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { VmcOverview } from "./VmcOverview";

const perms = new Set<string>();
vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: (p: string) => perms.has(p) }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const renderBar = () =>
  renderWithIntl(
    <VmcOverview
      welcome="Welcome Judith"
      stats={[{ label: "Onsite", value: 3 }]}
      onRegisterWalkIn={vi.fn()}
      onNewInvite={vi.fn()}
    />,
  );

describe("VmcOverview export (V1 parity)", () => {
  beforeEach(() => perms.clear());

  it("surfaces Export Data and Comms Opt-ins for VMC reception", () => {
    // The VMC role's seeded grants that drive these actions.
    perms.add(PERMISSIONS.REPORT_EXPORT);
    perms.add(PERMISSIONS.CONSENT_READ);
    perms.add(PERMISSIONS.CONSENT_EXPORT);
    renderBar();
    // Desktop bar and mobile panel both render in jsdom.
    expect(
      screen.getAllByRole("link", { name: /Comms Opt-ins/ })[0],
    ).toHaveAttribute("href", "/dashboard/opt-ins");
    fireEvent.click(screen.getAllByRole("button", { name: /Export Data/ })[0]);
    expect(screen.getByRole("dialog")).toHaveTextContent("Export Visitor Data");
  });

  it("hides Export without report:export", () => {
    perms.add(PERMISSIONS.CONSENT_READ);
    renderBar();
    expect(screen.queryByRole("button", { name: /Export Data/ })).toBeNull();
  });
});
