import { screen } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InboxItem } from "@/data/inbox/inbox.api";
import { renderWithIntl } from "@/test/render";
import { RecentActivityCard } from "./RecentActivityCard";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
let activity: {
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  data?: { items: InboxItem[] };
};
vi.mock("@/data/admin/queries", () => ({
  useRecentActivity: () => activity,
}));

const NOW = new Date("2026-10-19T10:00:00+01:00");
const minsAgo = (m: number) =>
  new Date(NOW.getTime() - m * 60_000).toISOString();
const base = {
  notesCount: 0,
  unread: false,
  createdAt: minsAgo(60),
};

const items: InboxItem[] = [
  {
    ...base,
    id: "a1",
    kind: "alert",
    alertId: "a1",
    status: "OPEN",
    level: "HIGH",
    reason: "Watchlist match",
    visitorName: "John Doe",
    updatedAt: minsAgo(2),
  },
  {
    ...base,
    id: "r1",
    kind: "request",
    visitId: "v1",
    status: "PENDING",
    visitorName: "Chidi Okonkwo",
    hostName: "Mrs. Adebayo",
    type: "WALK_IN",
    purpose: "Meeting",
    updatedAt: minsAgo(12),
  },
];

describe("RecentActivityCard", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    activity = {
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: { items },
    };
  });

  it("lists each event with its detail and how long ago, newest first", () => {
    renderWithIntl(<RecentActivityCard />);
    const [alert, request] = screen.getAllByRole("listitem");
    expect(alert).toHaveTextContent("Security alert raised");
    expect(alert).toHaveTextContent("John Doe");
    expect(alert).toHaveTextContent("2 minutes ago");
    expect(request).toHaveTextContent("New visit request");
    expect(request).toHaveTextContent("Chidi Okonkwo for Mrs. Adebayo");
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/admin/activity",
    );
  });

  it("does not render when there is no activity", () => {
    activity = {
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: { items: [] },
    };
    const { container } = renderWithIntl(<RecentActivityCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the card with an alert when loading fails", () => {
    activity = { isLoading: false, isError: true, isSuccess: false };
    renderWithIntl(<RecentActivityCard />);
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load");
    expect(screen.getByRole("region")).toBeInTheDocument();
  });
});
