import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { NO_BOARD_FILTERS, boardListParams } from "./_components/board-filters";
import DashboardPage from "./page";

const list = vi.fn();
const deskStats = vi.fn();
vi.mock("@/data/visits/visits.api", () => ({
  visitsApi: {
    list: (...a: unknown[]) => list(...a),
    deskStats: () => deskStats(),
  },
}));
vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { fullName: "Judith Francis" },
    hasPermission: () => false,
  }),
}));
vi.mock("@/shared/auth/RouteGuard", () => ({
  RouteGuard: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/app/[locale]/_components/AppTopNav", () => ({
  AppTopNav: () => null,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

describe("boardListParams", () => {
  it("keeps the board's three statuses when nothing is picked", () => {
    expect(boardListParams(NO_BOARD_FILTERS)).toEqual({
      statuses: ["APPROVED", "CHECKED_IN", "CHECKED_OUT"],
    });
  });

  it("narrows by status, type, purpose and a trimmed search", () => {
    expect(
      boardListParams({
        search: "  0803 552 ",
        status: "CHECKED_IN",
        type: "WALK_IN",
        purpose: "Official",
      }),
    ).toEqual({
      statuses: ["CHECKED_IN"],
      type: "WALK_IN",
      purpose: "Official",
      search: "0803 552",
    });
  });
});

describe("VMC dashboard", () => {
  beforeEach(() => {
    list.mockReset();
    deskStats.mockReset();
    list.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
    });
    deskStats.mockResolvedValue({
      onsite: 4,
      checkedInToday: 9,
      checkedOutToday: 5,
    });
  });

  it("shows today's real numbers instead of placeholders", async () => {
    renderWithIntl(<DashboardPage />);
    const bar = within(await screen.findByTestId("overview-bar-desktop"));
    expect(await bar.findByText("4")).toBeInTheDocument();
    expect(bar.getByText("9")).toBeInTheDocument();
    expect(bar.getByText("5")).toBeInTheDocument();
    expect(bar.queryByText("28")).toBeNull();
  });

  it("searches as you type, like the staff dashboard", async () => {
    renderWithIntl(<DashboardPage />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    const box = screen.getByLabelText(/Search visitor, host, floor, pass id/);
    fireEvent.change(box, { target: { value: "Adaeze " } });
    // Not on every keystroke: after a short pause, trimmed.
    expect(list.mock.calls.at(-1)?.[0]).not.toHaveProperty("search");
    await waitFor(() =>
      expect(list.mock.calls.at(-1)?.[0]).toMatchObject({
        search: "Adaeze",
        page: 1,
      }),
    );
  });

  it("shows an empty row when nothing matches", async () => {
    list.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 1,
    });
    renderWithIntl(<DashboardPage />);
    expect(await screen.findByText("No visits to show.")).toBeInTheDocument();
  });

  it("searches on Search and on Enter, and clears back to everything", async () => {
    renderWithIntl(<DashboardPage />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    const box = screen.getByLabelText(/Search visitor, host, floor, pass id/);
    fireEvent.change(box, { target: { value: "Ifeoma" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() =>
      expect(list.mock.calls.at(-1)?.[0]).toMatchObject({
        search: "Ifeoma",
        page: 1,
      }),
    );
    fireEvent.change(box, { target: { value: "0803 552 1904" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() =>
      expect(list.mock.calls.at(-1)?.[0]).toMatchObject({
        search: "0803 552 1904",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    await waitFor(() =>
      expect(list.mock.calls.at(-1)?.[0]).not.toHaveProperty("search"),
    );
  });

  it("filters the board by status", async () => {
    renderWithIntl(<DashboardPage />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("combobox", { name: "All Status" }));
    fireEvent.click(await screen.findByRole("option", { name: "Onsite" }));
    await waitFor(() =>
      expect(list.mock.calls.at(-1)?.[0]).toMatchObject({
        statuses: ["CHECKED_IN"],
      }),
    );
  });
});
