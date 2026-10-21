import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { VmcOverview } from "./VmcOverview";

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
});
