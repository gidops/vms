import type { EvacuationRollRow } from "@vms/contracts";
import type { EvacuationRoll } from "@vms/contracts";
import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { EvacuationRollScreen, groupByFloor } from "./EvacuationRollScreen";

const rollState: { data?: EvacuationRoll } = {};
vi.mock("@/data/evacuation/queries", () => ({
  useEvacuationRoll: () => ({
    data: rollState.data,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

const row = (
  visitId: string,
  floor: string | null,
  fullName: string,
  checkInAt = "2026-10-18T20:30:00Z",
  assistTypes: EvacuationRollRow["assistTypes"] = ["MOBILITY"],
  assistOther: string | null = null,
) => ({
  visitId,
  fullName,
  organization: "ECOWAS Commission",
  phone: "+2348034127781",
  floor,
  hostName: "Amb. Yusuf Danjuma",
  checkInAt: new Date(checkInAt),
  assistTypes,
  assistOther,
  badge: null,
});

describe("groupByFloor", () => {
  it("keeps the server's top-floor-first order and groups consecutive floors", () => {
    const groups = groupByFloor([
      row("a", "5th Floor", "A"),
      row("b", "5th Floor", "B"),
      row("c", "Ground Floor", "C"),
      row("d", null, "D"),
    ]);
    expect(groups.map((g) => [g.floor, g.rows.length])).toEqual([
      ["5th Floor", 2],
      ["Ground Floor", 1],
      [null, 1],
    ]);
  });
});

describe("EvacuationRollScreen", () => {
  beforeEach(() => {
    rollState.data = undefined;
  });

  it("shows the count banner, floor groups and WAT check-in times", () => {
    rollState.data = {
      generatedAt: new Date("2026-10-18T22:52:00Z"),
      count: 3,
      checkedInTotal: 16,
      rows: [
        row("a", "5th Floor", "Chukwuma Eze"),
        row("b", "5th Floor", "Aisha Mohammed"),
        row(
          "c",
          "Ground Floor",
          "Blessing Okafor",
          "2026-10-18T22:05:00Z",
          ["HEARING", "OTHER"],
          "Needs a ramp",
        ),
      ],
    };
    renderWithIntl(<EvacuationRollScreen />);
    const banner = screen.getByRole("status");
    expect(within(banner).getByText("3")).toBeInTheDocument();
    expect(banner).toHaveTextContent("on site need evacuation help");
    expect(banner).toHaveTextContent("2 floors");
    // What help each visitor asked for, under their name.
    expect(
      screen.getAllByText("Hearing, Other: Needs a ramp").length,
    ).toBeGreaterThan(0);
    expect(banner).not.toHaveTextContent("Generated");
    expect(screen.getAllByText("Chukwuma Eze").length).toBeGreaterThan(0);
    expect(screen.getAllByText("23:05").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^Print$/ })).toBeEnabled();
    // The print copy exists for window.print().
    expect(screen.getByTestId("evacuation-print")).toBeInTheDocument();
  });

  it("pages the table ten rows at a time and keeps the floor's full count", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      row(`v${i + 1}`, "5th Floor", `Visitor ${i + 1}`),
    );
    rollState.data = {
      generatedAt: new Date("2026-10-18T22:52:00Z"),
      count: rows.length,
      checkedInTotal: 20,
      rows,
    };
    renderWithIntl(<EvacuationRollScreen />);
    const table = () => screen.getByRole("table", { name: "Evacuation Roll" });
    expect(within(table()).getByText("Visitor 10")).toBeInTheDocument();
    expect(within(table()).queryByText("Visitor 11")).not.toBeInTheDocument();
    expect(within(table()).getByText(/· 12/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(within(table()).getByText("Visitor 11")).toBeInTheDocument();
    expect(within(table()).queryByText("Visitor 1")).not.toBeInTheDocument();
    expect(within(table()).getByText(/· 12/)).toBeInTheDocument();
    // Printing still covers the whole roll.
    // (The print cell holds the name plus the assistance line.)
    const printed = screen.getByTestId("evacuation-print").textContent ?? "";
    expect(printed).toContain("Visitor 1Mobility");
    expect(printed).toContain("Visitor 12");
  });

  it("shows the green empty state and disables printing", () => {
    rollState.data = {
      generatedAt: new Date("2026-10-18T22:52:00Z"),
      count: 0,
      checkedInTotal: 16,
      rows: [],
    };
    renderWithIntl(<EvacuationRollScreen />);
    expect(
      screen.getByText("No one on site needs evacuation help"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "16 visitors are checked in. None asked for assistance.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Print$/ })).toBeDisabled();
    expect(screen.queryByTestId("evacuation-print")).not.toBeInTheDocument();
  });
});
