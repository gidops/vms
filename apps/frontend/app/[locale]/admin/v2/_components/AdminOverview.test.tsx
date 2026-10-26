import { screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { AdminOverview } from "./AdminOverview";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: React.ComponentProps<"a">) => (
    <a {...rest}>{children}</a>
  ),
}));

const stats = [{ label: "Checked in", value: 4 }];

// Desktop and mobile copies of the panel both render in jsdom.
const panels = () =>
  screen.getAllByTestId("panel-content").map((el) => el.parentElement!);

describe("AdminOverview", () => {
  it("tints the panel red, not green, while people are on the Evacuation Roll", () => {
    renderWithIntl(
      <AdminOverview
        eyebrow="ADMIN CONSOLE"
        welcome="Welcome"
        stats={stats}
        panelTone="alert"
        panel={<span data-testid="panel-content" />}
      />,
    );
    for (const panel of panels()) {
      expect(panel.className).toContain("var(--color-danger)");
      expect(panel.className).not.toMatch(/\bbg-emphasis\b/);
    }
  });

  it("keeps the brand-green panel otherwise", () => {
    renderWithIntl(
      <AdminOverview
        eyebrow="ADMIN CONSOLE"
        welcome="Welcome"
        stats={stats}
        panel={<span data-testid="panel-content" />}
      />,
    );
    for (const panel of panels()) {
      expect(panel.className).toMatch(/\bbg-emphasis\b/);
    }
  });

  it("adds a chevron link on a stat that has one (SM Awaiting approval)", () => {
    renderWithIntl(
      <AdminOverview
        eyebrow="SECURITY CONSOLE"
        welcome="Welcome"
        stats={[
          {
            label: "Awaiting approval",
            value: 3,
            tone: "warning",
            link: {
              href: "/admin/v2/approvals",
              label: "Open Pending Approvals",
            },
          },
          { label: "Onsite", value: 2 },
        ]}
        panel={<span data-testid="panel-content" />}
      />,
    );
    const [link] = screen.getAllByRole("link", {
      name: "Open Pending Approvals",
    });
    expect(link).toHaveAttribute("href", "/admin/v2/approvals");
    // Only the linked stat gets one (desktop + mobile copies of that cell).
    expect(
      screen.getAllByRole("link", { name: "Open Pending Approvals" }).length,
    ).toBeLessThanOrEqual(2);
  });
});
