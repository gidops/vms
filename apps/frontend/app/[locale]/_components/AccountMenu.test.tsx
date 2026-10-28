import { fireEvent, screen, waitFor } from "@testing-library/react";
import type * as React from "react";
import { PERMISSIONS } from "@vms/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { AccountMenu } from "./AccountMenu";

const perms = new Set<string>();
let roles: string[] = ["VMC"];
const switchRole = vi.fn();
const replace = vi.fn();
vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { fullName: "Judith Francis", roles },
    activeRole: "VMC",
    logout: vi.fn(),
    switchRole,
    hasPermission: (p: string) => perms.has(p),
  }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ replace }),
}));

describe("AccountMenu", () => {
  beforeEach(() => {
    perms.clear();
    roles = ["VMC"];
    switchRole.mockReset();
    replace.mockReset();
  });

  it("links Insights to the insights page", () => {
    renderWithIntl(<AccountMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Judith Francis" }));
    expect(screen.getByRole("link", { name: "Insights" })).toHaveAttribute(
      "href",
      "/insights",
    );
  });

  it("shows Operations only to the System Admin", () => {
    renderWithIntl(<AccountMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Judith Francis" }));
    expect(screen.queryByRole("link", { name: "Operations" })).toBeNull();
  });

  it("links Operations when an Operations tab is open to the user", () => {
    perms.add(PERMISSIONS.AUDIT_READ);
    renderWithIntl(<AccountMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Judith Francis" }));
    expect(screen.getByRole("link", { name: "Operations" })).toHaveAttribute(
      "href",
      "/operations",
    );
  });

  it("has no Switch account row for a single-role user", () => {
    renderWithIntl(<AccountMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Judith Francis" }));
    expect(
      screen.queryByRole("button", { name: /switch account/i }),
    ).toBeNull();
  });

  it("expands the roles under Switch account and switches to the picked one", async () => {
    roles = ["VMC", "STAFF"];
    switchRole.mockResolvedValue({ activeRole: "STAFF" });
    renderWithIntl(<AccountMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Judith Francis" }));

    const toggle = screen.getByRole("button", { name: /switch account/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /VMC/ })).toHaveAttribute(
      "aria-current",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: /Staff/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff"));
    expect(switchRole).toHaveBeenCalledWith("STAFF");
  });
});
