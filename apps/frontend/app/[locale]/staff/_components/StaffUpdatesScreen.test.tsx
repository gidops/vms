import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffActivityItem } from "@/data/staff/staff.api";
import { renderWithIntl } from "@/test/render";
import { StaffUpdatesScreen } from "./StaffUpdatesScreen";

const feedParams = vi.fn();
let data: { items: StaffActivityItem[]; totalPages: number };
vi.mock("@/data/staff/queries", () => ({
  useStaffActivityFeed: (p: unknown) => {
    feedParams(p);
    return { isLoading: false, data };
  },
}));
vi.mock("@/app/[locale]/_components/AppTopNav", () => ({
  AppTopNav: () => null,
}));
vi.mock("@/app/[locale]/_components/VisitDetailSheet", () => ({
  VisitDetailSheet: () => null,
}));

const item = (
  id: string,
  over: Partial<StaffActivityItem> = {},
): StaffActivityItem => ({
  id,
  category: "REQUEST_UPDATE",
  title: "Visit approved",
  body: "Ngozi Achebe was approved.",
  visitId: `visit-${id}`,
  alertId: null,
  createdAt: new Date().toISOString(),
  ...over,
});

describe("StaffUpdatesScreen", () => {
  beforeEach(() => {
    feedParams.mockReset();
    data = {
      items: [
        item("1"),
        item("2", { category: "SECURITY_ALERT", title: "Security alert" }),
      ],
      totalPages: 3,
    };
  });

  it("lays out like Requests & Alerts: filter bar, inbox cards, pagination", () => {
    renderWithIntl(<StaffUpdatesScreen />);
    expect(
      screen.getByRole("searchbox", { name: "Search visitor name or email" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Update type" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by day")).toBeInTheDocument();
    // Desktop inbox cards and mobile update cards both render in jsdom.
    expect(screen.getAllByText("Visit approved")).toHaveLength(2);
    expect(screen.getAllByText("Security alert")).toHaveLength(2);
    // The standard numbered pagination, on page 1 of 3.
    const pager = screen.getByRole("navigation", { name: "Pagination" });
    expect(
      within(pager).getAllByRole("button", { current: "page" })[0],
    ).toHaveTextContent("1");
    expect(
      within(pager).getAllByRole("button", { name: "3" }).length,
    ).toBeGreaterThan(0);
  });

  it("pages the feed server-side, 12 at a time", () => {
    renderWithIntl(<StaffUpdatesScreen />);
    expect(feedParams).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, pageSize: 12 }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(feedParams).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });

  it("names each mobile card's next step: alert details, answering SM feedback, or the update", () => {
    data = {
      items: [
        item("1"),
        item("2", { category: "SECURITY_ALERT", alertId: "a2" }),
        item("3", { category: "SM_FEEDBACK", title: "From S.M Desk" }),
      ],
      totalPages: 1,
    };
    renderWithIntl(<StaffUpdatesScreen />);
    const cards = screen
      .getAllByRole("listitem")
      .map((li) => li.textContent ?? "");
    expect(cards[0]).toContain("View Update");
    expect(cards[1]).toContain("View Details");
    expect(cards[2]).toContain("Update Request");
  });
});
