import { fireEvent, screen } from "@testing-library/react";
import type * as React from "react";
import { PERMISSIONS } from "@vms/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { AccountMenu } from "./AccountMenu";

const perms = new Set<string>();
vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { fullName: "Judith Francis" },
    activeRole: "VMC",
    logout: vi.fn(),
    hasPermission: (p: string) => perms.has(p),
  }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("AccountMenu", () => {
  beforeEach(() => perms.clear());

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
});
