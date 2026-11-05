import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VisitRequestDetail } from "@/data/visits/visits.api";
import { renderWithIntl } from "@/test/render";
import { CheckOutModal } from "./CheckOutModal";

const state: {
  visit?: VisitRequestDetail;
  mutateAsync: ReturnType<typeof vi.fn>;
} = { mutateAsync: vi.fn() };

vi.mock("@/data/requests/queries", () => ({
  useVisitRequest: () => ({ data: state.visit }),
  useCheckOut: () => ({
    mutateAsync: state.mutateAsync,
    isPending: false,
    isError: false,
    error: null,
  }),
}));
vi.mock("@/data/access-cards/queries", () => ({
  useAvailableCards: () => ({ data: [] }),
}));

const visit = (over: Partial<VisitRequestDetail> = {}): VisitRequestDetail =>
  ({
    id: "v1",
    type: "WALK_IN",
    status: "CHECKED_IN",
    purpose: "Meeting",
    checkInAt: "2026-10-27T08:00:00Z",
    visitor: { id: "p1", fullName: "Ada Obi", email: "ada@x.com" },
    host: null,
    notes: [],
    alerts: [],
    ...over,
  }) as VisitRequestDetail;

const card = {
  assignmentId: "a1",
  cardNumber: "0042",
  validUntil: "2026-10-30T17:00:00Z",
  overdue: false,
};

const confirm = () =>
  fireEvent.click(screen.getByRole("button", { name: "Complete Check-Out" }));

describe("CheckOutModal — RFID card return", () => {
  beforeEach(() => {
    state.mutateAsync = vi.fn().mockResolvedValue({});
  });

  it("asks nothing about a card when the guest holds none", async () => {
    state.visit = visit();
    renderWithIntl(<CheckOutModal visitId="v1" onClose={vi.fn()} />);
    expect(screen.queryByText("RFID access card")).not.toBeInTheDocument();
    confirm();
    await waitFor(() => expect(state.mutateAsync).toHaveBeenCalledWith({}));
  });

  it("blocks check-out until the card question is answered", () => {
    state.visit = visit({ rfidCard: card });
    renderWithIntl(<CheckOutModal visitId="v1" onClose={vi.fn()} />);
    expect(screen.getByText("RFID access card")).toBeInTheDocument();
    expect(screen.getAllByText("RFID 0042").length).toBeGreaterThan(0);
    const group = screen.getByRole("radiogroup", {
      name: "Was the card handed back?",
    });
    group
      .querySelectorAll('[role="radio"]')
      .forEach((r) => expect(r).toHaveAttribute("aria-checked", "false"));
    confirm();
    expect(
      screen.getByText("Say whether the card was retrieved."),
    ).toBeInTheDocument();
    expect(state.mutateAsync).not.toHaveBeenCalled();
  });

  it("sends RETURNED once the card is retrieved", async () => {
    state.visit = visit({ rfidCard: card });
    renderWithIntl(<CheckOutModal visitId="v1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Card retrieved" }));
    confirm();
    await waitFor(() =>
      expect(state.mutateAsync).toHaveBeenCalledWith({
        rfidCard: { outcome: "RETURNED" },
      }),
    );
  });

  it("requires a note when the card was not returned", async () => {
    state.visit = visit({ rfidCard: { ...card, overdue: true } });
    renderWithIntl(<CheckOutModal visitId="v1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Not returned" }));
    confirm();
    expect(screen.getByText("Add a note about the card.")).toBeInTheDocument();
    expect(state.mutateAsync).not.toHaveBeenCalled();

    fireEvent.change(
      screen.getByRole("textbox", { name: "What happened to the card?" }),
      { target: { value: "  Left with it  " } },
    );
    confirm();
    await waitFor(() =>
      expect(state.mutateAsync).toHaveBeenCalledWith({
        rfidCard: { outcome: "LOST", note: "Left with it" },
      }),
    );
  });
});
