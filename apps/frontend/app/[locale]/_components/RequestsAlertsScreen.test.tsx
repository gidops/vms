import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InboxCardItem } from "@/data/inbox/inbox.api";
import { renderWithIntl } from "@/test/render";
import { RequestsAlertsScreen } from "./RequestsAlertsScreen";

const state: { items: InboxCardItem[] } = { items: [] };
const opened = vi.fn();

vi.mock("@/data/requests/queries", () => ({
  useInbox: () => ({
    data: { items: state.items, totalPages: 1 },
    isLoading: false,
  }),
  useMarkInboxSeen: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/app/[locale]/_components/AppTopNav", () => ({
  AppTopNav: () => null,
}));
vi.mock("@/app/[locale]/admin/_components/AdminShell", () => ({
  AdminShell: () => null,
}));
vi.mock("@/app/[locale]/_components/VisitDetailSheet", () => ({
  VisitDetailSheet: (p: { kind: string; id: string }) => {
    opened(p.kind, p.id);
    return null;
  },
}));

const cardItem = (over: Partial<InboxCardItem> = {}): InboxCardItem => ({
  kind: "card",
  id: "c1",
  assignmentId: "a1",
  cardNumber: "0042",
  validUntil: "2026-10-20T17:00:00Z",
  visitorName: "Ada Obi",
  visitId: "v1",
  organization: null,
  createdAt: "2026-10-01T08:00:00Z",
  updatedAt: "2026-10-20T17:00:00Z",
  unread: false,
  notesCount: 0,
  ...over,
});

describe("RequestsAlertsScreen — overdue card items", () => {
  beforeEach(() => {
    opened.mockClear();
  });

  it("renders the card and opens its visit", () => {
    state.items = [cardItem()];
    renderWithIntl(<RequestsAlertsScreen />);
    expect(screen.getByText("Access card overdue")).toBeInTheDocument();
    expect(screen.getByText(/Ada Obi still has card 0042/)).toBeInTheDocument();
    expect(screen.getByText("RFID 0042")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Cards" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Access card overdue"));
    expect(opened).toHaveBeenCalledWith("request", "v1");
  });

  it("does nothing on click when the card has no visit", () => {
    state.items = [cardItem({ visitId: null })];
    renderWithIntl(<RequestsAlertsScreen />);
    fireEvent.click(screen.getByText("Access card overdue"));
    expect(opened).not.toHaveBeenCalled();
  });

  it("hides the Cards tab from a host's own feed", () => {
    state.items = [];
    renderWithIntl(<RequestsAlertsScreen app="staff" scope="mine" />);
    expect(
      screen.queryByRole("radio", { name: "Cards" }),
    ).not.toBeInTheDocument();
  });
});
