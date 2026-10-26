import { fireEvent, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { AccountMenu } from "./AccountMenu";

vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { fullName: "Judith Francis" },
    activeRole: "VMC",
    logout: vi.fn(),
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
  it("links Insights to the insights page", () => {
    renderWithIntl(<AccountMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Judith Francis" }));
    expect(screen.getByRole("link", { name: "Insights" })).toHaveAttribute(
      "href",
      "/insights",
    );
  });
});
