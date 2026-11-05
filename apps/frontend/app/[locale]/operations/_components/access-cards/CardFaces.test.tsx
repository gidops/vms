import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/render";
import { AssignmentBadge } from "./AssignmentBadge";
import { CardBack, CardFront } from "./CardFaces";
import { defaultValidity, splitWat, watIso } from "./wat-input";

const card = {
  fullName: "Ifeoma Chukwu",
  organization: "Guaranty Trust Bank",
  cardNumber: "RF-0042",
  validFrom: "2026-10-24T07:00:00.000Z",
  validUntil: "2026-10-26T17:00:00.000Z",
  photoUrl: null,
};

describe("access card faces", () => {
  it("prints the visitor, validity (WAT) and card number on the front", () => {
    renderWithIntl(<CardFront card={card} />);
    const front = screen.getByRole("img", { name: /Card front for Ifeoma/ });
    expect(front).toHaveAttribute("data-theme", "light");
    expect(front).toHaveTextContent("VISITOR ACCESS");
    expect(front).toHaveTextContent("Ifeoma Chukwu");
    expect(front).toHaveTextContent("Guaranty Trust Bank");
    expect(front).toHaveTextContent("RF-0042");
    // 07:00Z = 08:00 WAT; 17:00Z = 18:00 WAT.
    expect(front).toHaveTextContent(/24 Oct 2026, 08:00 – 26 Oct 2026, 18:00/);
  });

  it("puts the return notice and card number on the back", () => {
    renderWithIntl(<CardBack card={card} />);
    const back = screen.getByRole("img", { name: "Card back" });
    expect(back).toHaveTextContent("RF-0042");
    expect(back).toHaveTextContent(
      /must be returned to the Visitor Management Centre/,
    );
  });
});

describe("WAT inputs", () => {
  it("round-trips a WAT date and time", () => {
    const iso = watIso("2026-10-24", "08:00");
    expect(iso).toBe("2026-10-24T07:00:00.000Z");
    expect(splitWat(iso)).toEqual({ date: "2026-10-24", time: "08:00" });
    expect(watIso("", "08:00")).toBe("");
  });

  it("defaults to today 08:00 → 18:00 WAT", () => {
    expect(defaultValidity(new Date("2026-10-24T23:30:00Z"))).toEqual({
      fromDate: "2026-10-25",
      fromTime: "08:00",
      untilDate: "2026-10-25",
      untilTime: "18:00",
    });
  });
});

describe("AssignmentBadge", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  it.each([
    [
      { status: "ACTIVE", overdue: true, validUntil: card.validFrom },
      "Overdue for return",
    ],
    [
      { status: "ACTIVE", overdue: false, validUntil: "2026-10-24T17:00:00Z" },
      "Ends today",
    ],
    [
      { status: "ACTIVE", overdue: false, validUntil: card.validUntil },
      "Active",
    ],
    [
      { status: "RETURNED", overdue: false, validUntil: card.validUntil },
      "Returned",
    ],
    [{ status: "LOST", overdue: false, validUntil: card.validUntil }, "Lost"],
  ] as const)("labels %o as %s", (item, label) => {
    renderWithIntl(<AssignmentBadge item={item} now={now} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
