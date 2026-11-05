import { fireEvent, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { VmcOverview } from "./VmcOverview";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<React.ComponentProps<"a">, "href"> & {
    href: { pathname: string; query: Record<string, string> };
  }) => (
    <a href={`${href.pathname}?${new URLSearchParams(href.query)}`} {...rest}>
      {children}
    </a>
  ),
}));

describe("VmcOverview quick actions", () => {
  it("keeps only the desk's two actions (the admin tools live on Help/Support)", () => {
    const onRegisterWalkIn = vi.fn();
    renderWithIntl(
      <VmcOverview
        welcome="Welcome Judith"
        stats={[{ label: "Onsite", value: 3 }]}
        onRegisterWalkIn={onRegisterWalkIn}
        onNewInvite={vi.fn()}
      />,
    );
    // Desktop bar and mobile panel both render in jsdom.
    fireEvent.click(
      screen.getAllByRole("button", { name: "Register Walk-In" })[0],
    );
    expect(onRegisterWalkIn).toHaveBeenCalled();
    expect(
      screen.getAllByRole("button", { name: "New Invite Request" }).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button", { name: /Export Data/ })).toBeNull();
  });

  it("tints the panel and links to the roll when people need evacuation help", () => {
    renderWithIntl(
      <VmcOverview
        welcome="Welcome Judith"
        stats={[{ label: "Onsite", value: 3 }]}
        onRegisterWalkIn={vi.fn()}
        onNewInvite={vi.fn()}
        evacuationCount={3}
      />,
    );
    const links = screen.getAllByRole("link", {
      name: /3 need evacuation help · View roll/,
    });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/insights?tab=evacuation");
  });

  it("stays green with no link when nobody is on the roll", () => {
    renderWithIntl(
      <VmcOverview
        welcome="Welcome Judith"
        stats={[{ label: "Onsite", value: 3 }]}
        onRegisterWalkIn={vi.fn()}
        onNewInvite={vi.fn()}
        evacuationCount={0}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
  });
});
