import { screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { StaffOverview } from "./StaffOverview";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: React.ComponentProps<"a">) => (
    <a {...rest}>{children}</a>
  ),
}));

const stats = [
  { label: "Expected Guests", value: 2 },
  { label: "Awaiting SM Approval", value: 1 },
  { label: "Onsite", value: 0 },
];

describe("StaffOverview — Office Floor", () => {
  it("shows the host's floor in the Figma orange under the teal label", () => {
    renderWithIntl(
      <StaffOverview
        welcome="Welcome Judith Francis"
        stats={stats}
        office="3rd Floor - LW"
        onNewInvite={vi.fn()}
      />,
    );
    // Desktop and mobile copies both render in jsdom.
    const [label] = screen.getAllByText("Office Floor:");
    const [floor] = screen.getAllByText("3rd Floor - LW");
    expect(label).toHaveClass("text-[#00736E]");
    expect(floor).toHaveClass("text-[#FF6900]", "uppercase");
  });

  it("still shows the label, with Not set, before a desk is chosen", () => {
    renderWithIntl(
      <StaffOverview
        welcome="Welcome Judith Francis"
        stats={stats}
        office={null}
        onNewInvite={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Office Floor:").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not set").length).toBeGreaterThan(0);
  });
});
