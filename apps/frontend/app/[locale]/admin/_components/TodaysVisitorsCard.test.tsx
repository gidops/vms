import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VisitListItem } from "@/data/visits/visits.api";
import { renderWithIntl } from "@/test/render";
import { TodaysVisitorsCard } from "./TodaysVisitorsCard";

type Query = {
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  data?: { items: VisitListItem[]; total: number; totalPages: number };
};
let visitors: Query;
const calls: unknown[][] = [];
vi.mock("@/data/admin/queries", () => ({
  useTodaysVisitors: (...args: unknown[]) => {
    calls.push(args);
    return visitors;
  },
}));

const NOW = new Date("2026-10-19T10:32:00+01:00");

function visit(
  id: string,
  name: string,
  over: Partial<VisitListItem> = {},
): VisitListItem {
  return {
    id,
    type: "PRE_INVITED",
    status: "APPROVED",
    purpose: "Meeting",
    createdAt: "2026-10-19T07:00:00Z",
    scheduledAt: "2026-10-19T09:45:00Z",
    isGroupVisit: false,
    groupSize: 1,
    visitor: { id: `v-${id}`, fullName: name, email: `${id}@x.com` },
    host: {
      id: "h",
      user: { id: "u", fullName: "Dr. Okeke", email: "o@x.com" },
    },
    ...over,
  };
}

const rows = [
  visit("1", "Amaka Bello", {
    status: "CHECKED_IN",
    checkInAt: "2026-10-19T08:12:00Z",
  }),
  visit("2", "Lagos Chamber", {
    isGroupVisit: true,
    groupName: "Lagos Chamber",
    groupSize: 4,
  }),
  visit("3", "Grace Hassan"),
];

const ok = (items: VisitListItem[], total = items.length): Query => ({
  isLoading: false,
  isError: false,
  isSuccess: true,
  data: { items, total, totalPages: Math.ceil(total / 5) },
});

describe("TodaysVisitorsCard", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    calls.length = 0;
    visitors = ok(rows, 64);
  });

  it("lists visitors with host, time and status like the overview mock", () => {
    renderWithIntl(<TodaysVisitorsCard search="" onView={vi.fn()} />);
    const [amaka, group, grace] = screen.getAllByTestId("todays-visitor-row");
    // Onsite: check-in time and how long they've been in.
    expect(amaka).toHaveTextContent("Dr. Okeke");
    expect(amaka).toHaveTextContent("9:12 AM");
    expect(amaka).toHaveTextContent("Onsite · 1h 20m");
    expect(group).toHaveTextContent("Group · 4 guests");
    // Expected: the scheduled time.
    expect(grace).toHaveTextContent("10:45 AM");
    expect(grace).toHaveTextContent("Expected");
    expect(screen.getByText("1–3 of 64")).toBeInTheDocument();
  });

  it("filters by status and opens a visit", () => {
    const onView = vi.fn();
    renderWithIntl(<TodaysVisitorsCard search="" onView={onView} />);
    fireEvent.click(screen.getByRole("radio", { name: "Onsite" }));
    expect(calls.at(-1)).toEqual(["", 1, 5, ["CHECKED_IN"]]);
    fireEvent.click(screen.getByRole("button", { name: "View Grace Hassan" }));
    expect(onView).toHaveBeenCalledWith("3");
  });

  it("does not render when nobody is scheduled today", () => {
    visitors = ok([]);
    const { container } = renderWithIntl(
      <TodaysVisitorsCard search="" onView={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the card with a message when a search or filter matches nothing", () => {
    visitors = ok([]);
    renderWithIntl(<TodaysVisitorsCard search="zzz" onView={vi.fn()} />);
    expect(
      screen.getByText("No visitors match your search."),
    ).toBeInTheDocument();
  });

  it("shows a spinner while loading and an alert on error", () => {
    visitors = { isLoading: true, isError: false, isSuccess: false };
    const { unmount } = renderWithIntl(
      <TodaysVisitorsCard search="" onView={vi.fn()} />,
    );
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    unmount();
    visitors = { isLoading: false, isError: true, isSuccess: false };
    renderWithIntl(<TodaysVisitorsCard search="" onView={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load");
  });
});
