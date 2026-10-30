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
        eyebrow="VMC HUB"
        welcome="Good morning"
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
    renderWithIntl(
      <OverviewBar eyebrow="HUB" welcome="Hi" stats={stats} panel={null} />,
    );
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
    const { unmount } = renderWithIntl(
      <OverviewBar
        eyebrow="HUB"
        welcome="Hi"
        aside={<span>3RD FLOOR</span>}
        stats={stats}
        panel={null}
      />,
    );
    let bar = screen.getByTestId("overview-bar-desktop");
    expect(within(bar).getByText("Hi").parentElement).toHaveClass("col-span-3");
    expect(within(bar).getByText("3RD FLOOR")).toBeInTheDocument();
    unmount();
    renderWithIntl(
      <OverviewBar eyebrow="HUB" welcome="Hi" stats={stats} panel={null} />,
    );
    bar = screen.getByTestId("overview-bar-desktop");
    expect(within(bar).getByText("Hi").parentElement).toHaveClass("col-span-4");
  });

  it("keeps the mobile stats collapsed behind View your activity until opened", () => {
    renderWithIntl(
      <OverviewBar eyebrow="HUB" welcome="Hi" stats={stats} panel={null} />,
    );
    const toggle = screen.getByRole("button", { name: "View your activity" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // Only the desktop bar's copy until the mobile list opens.
    expect(screen.getAllByText("Onsite now")).toHaveLength(1);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("Onsite now")).toHaveLength(2);
  });

  it("swaps in the mobile eyebrow on small screens only", () => {
    renderWithIntl(
      <OverviewBar
        eyebrow="STAFF HUB"
        mobileEyebrow="3RD FLOOR - LW"
        welcome="Hi"
        stats={stats}
        panel={null}
      />,
    );
    const bar = screen.getByTestId("overview-bar-desktop");
    expect(within(bar).getByText("STAFF HUB")).toBeInTheDocument();
    expect(within(bar).queryByText("3RD FLOOR - LW")).toBeNull();
    expect(screen.getAllByText("STAFF HUB")).toHaveLength(1);
    expect(screen.getByText("3RD FLOOR - LW")).toBeInTheDocument();
  });
});
