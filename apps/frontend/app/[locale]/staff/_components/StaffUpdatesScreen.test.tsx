import { fireEvent, screen } from "@testing-library/react";
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
    expect(screen.getByText("Visit approved")).toBeInTheDocument();
    expect(screen.getByText("Security alert")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
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
});
