import { fireEvent, screen, within } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { OverviewBar } from "./OverviewBar";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: React.ComponentProps<"a">) => (
    <a {...rest}>{children}</a>
  ),
}));

const stats = [
  {
    label: "Awaiting approval",
    value: 7,
    tone: "warning" as const,
    hint: "2 waiting over 1 hour",
  },
  { label: "Onsite now", value: 23 },
  { label: "Expected today", value: 41 },
];

describe("OverviewBar", () => {
  it("renders heading, stat cells and the action panel in the desktop bar", () => {
    renderWithIntl(
      <OverviewBar
        heading={<h1>Good morning</h1>}
        stats={stats}
        panel={<button type="button">Review approvals</button>}
      />,
    );
    const bar = screen.getByTestId("overview-bar-desktop");
    expect(
      within(bar).getByRole("heading", { name: "Good morning" }),
    ).toBeInTheDocument();
    expect(within(bar).getByText("23")).toBeInTheDocument();
    expect(within(bar).getByText("2 waiting over 1 hour")).toBeInTheDocument();
    expect(
      within(bar).getByRole("button", { name: "Review approvals" }),
    ).toBeInTheDocument();
  });

  it("marks the warning stat as the hero tone", () => {
    renderWithIntl(<OverviewBar heading="Hi" stats={stats} panel={null} />);
    const bar = screen.getByTestId("overview-bar-desktop");
    const hero = within(bar)
      .getByText("Awaiting approval")
      .closest("[data-tone]");
    expect(hero).toHaveAttribute("data-tone", "warning");
    expect(hero?.parentElement).toHaveClass("bg-warning-subtle");
    const plain = within(bar).getByText("Onsite now").closest("[data-tone]");
    expect(plain).toHaveAttribute("data-tone", "default");
    expect(plain?.parentElement).toHaveClass("bg-primary-subtle");
  });

  it("puts the aside in the heading row and spans the heading otherwise", () => {
    const { rerender } = renderWithIntl(
      <OverviewBar
        heading="Hi"
        aside={<span>3RD FLOOR</span>}
        stats={stats}
        panel={null}
      />,
    );
    let bar = screen.getByTestId("overview-bar-desktop");
    expect(within(bar).getByText("Hi")).toHaveClass("col-span-3");
    expect(within(bar).getByText("3RD FLOOR")).toBeInTheDocument();
    rerender(<OverviewBar heading="Hi" stats={stats} panel={null} />);
    bar = screen.getByTestId("overview-bar-desktop");
    expect(within(bar).getByText("Hi")).toHaveClass("col-span-4");
  });

  it("collapses the mobile stats behind a toggle when asked", () => {
    renderWithIntl(
      <OverviewBar
        heading="Hi"
        stats={stats}
        panel={null}
        mobileStats="collapsible"
        collapsibleLabel="View your activity"
      />,
    );
    const toggle = screen.getByRole("button", { name: "View your activity" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    // Desktop bar + mobile list.
    expect(screen.getAllByText("Onsite now")).toHaveLength(2);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByText("Onsite now")).toHaveLength(1);
  });
});
