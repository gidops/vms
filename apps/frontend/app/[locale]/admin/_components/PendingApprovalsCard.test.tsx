import { fireEvent, screen } from "@testing-library/react";
import { PERMISSIONS } from "@vms/contracts";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VisitListItem } from "@/data/visits/visits.api";
import { renderWithIntl } from "@/test/render";
import { PendingApprovalsCard } from "./PendingApprovalsCard";
import {
  countOverdue,
  sortOldestFirst,
  waitingMinutes,
} from "./pendingApprovals";

const perms = new Set<string>();
vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: (p: string) => perms.has(p) }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const sheet = vi.fn();
vi.mock("@/app/[locale]/_components/VisitDetailSheet", () => ({
  VisitDetailSheet: (props: { id: string; initialForm?: string | null }) => {
    sheet(props);
    return (
      <div role="dialog">
        sheet {props.id} {props.initialForm ?? "view"}
      </div>
    );
  },
}));
const groupSheet = vi.fn();
vi.mock("@/app/[locale]/requests/_components/GroupApprovalSheet", () => ({
  GroupApprovalSheet: (props: { groupId: string }) => {
    groupSheet(props);
    return <div role="dialog">group {props.groupId}</div>;
  },
}));

let pending: {
  isLoading: boolean;
  isError: boolean;
  data?: { items: VisitListItem[]; total: number };
};
vi.mock("@/data/requests/queries", () => ({
  usePendingVisits: () => pending,
}));

const NOW = new Date("2026-10-19T12:00:00+01:00");
const minsAgo = (m: number) =>
  new Date(NOW.getTime() - m * 60_000).toISOString();

function visit(
  id: string,
  name: string,
  waited: number,
  over: Partial<VisitListItem> = {},
): VisitListItem {
  return {
    id,
    type: "WALK_IN",
    status: "PENDING",
    purpose: "Meeting",
    createdAt: minsAgo(waited),
    scheduledAt: minsAgo(-60),
    isGroupVisit: false,
    groupSize: 1,
    visitor: { id: `v-${id}`, fullName: name, email: `${id}@x.com` },
    host: {
      id: "h",
      user: { id: "u", fullName: "Mrs. Adebayo", email: "a@x.com" },
    },
    ...over,
  };
}

const items = [
  visit("3", "Fatima Nwosu", 38),
  visit("6", "Newest Person", 2),
  visit("1", "Chidi Okonkwo", 72),
  visit("5", "Fifth Person", 10),
  visit("2", "Ecowas Youth Delegation", 64, {
    isGroupVisit: true,
    groupId: "g-1",
    groupName: "Ecowas Youth Delegation",
    groupSize: 12,
  }),
  visit("4", "Kwame Mensah", 20),
];

describe("pending approvals helpers", () => {
  it("orders oldest first without mutating", () => {
    const copy = [...items];
    expect(sortOldestFirst(items).map((v) => v.id)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
    expect(items).toEqual(copy);
  });
  it("measures waiting time and overdue count", () => {
    expect(waitingMinutes(minsAgo(72), NOW)).toBe(72);
    expect(waitingMinutes(minsAgo(-5), NOW)).toBe(0);
    expect(countOverdue(items, NOW)).toBe(2);
  });
});

describe("PendingApprovalsCard", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    perms.clear();
    perms.add(PERMISSIONS.VISIT_APPROVE);
    perms.add(PERMISSIONS.VISIT_DENY);
    sheet.mockReset();
    groupSheet.mockReset();
    pending = {
      isLoading: false,
      isError: false,
      data: { items, total: items.length },
    };
  });

  it("shows the four oldest requests, oldest first, with See all", () => {
    renderWithIntl(<PendingApprovalsCard />);
    const rows = screen.getAllByTestId("pending-approval-row");
    expect(rows).toHaveLength(4);
    expect(
      rows.map((r) => r.querySelector(".font-semibold")?.textContent),
    ).toEqual([
      "Chidi Okonkwo",
      "Ecowas Youth Delegation",
      "Fatima Nwosu",
      "Kwame Mensah",
    ]);
    expect(screen.queryByText("Newest Person")).toBeNull();
    expect(screen.getByText("6 waiting")).toBeInTheDocument();
    expect(screen.getByText("Showing 4 of 6")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all 6" })).toHaveAttribute(
      "href",
      "/admin/requests",
    );
    expect(screen.getByText("1h 12m")).toBeInTheDocument();
    expect(screen.getByText("38m")).toBeInTheDocument();
  });

  it("opens the deny sheet, the approve sheet and the group review sheet", () => {
    renderWithIntl(<PendingApprovalsCard />);
    fireEvent.click(screen.getByRole("button", { name: "Deny Chidi Okonkwo" }));
    expect(sheet).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "1", initialForm: "deny" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Approve Fatima Nwosu" }),
    );
    expect(sheet).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "3", initialForm: null }),
    );
    expect(
      screen.queryByRole("button", { name: "Approve Ecowas Youth Delegation" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Review group Ecowas Youth Delegation",
      }),
    );
    expect(groupSheet).toHaveBeenLastCalledWith({
      groupId: "g-1",
      onClose: expect.any(Function),
    });
  });

  it("collapses to a one-line All caught up when nothing is waiting", () => {
    pending = {
      isLoading: false,
      isError: false,
      data: { items: [], total: 0 },
    };
    renderWithIntl(<PendingApprovalsCard />);
    expect(screen.getByRole("status")).toHaveTextContent("All caught up");
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows loading and error lines", () => {
    pending = { isLoading: true, isError: false };
    const { unmount } = renderWithIntl(<PendingApprovalsCard />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading approvals");
    unmount();
    pending = { isLoading: false, isError: true };
    renderWithIntl(<PendingApprovalsCard />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load pending approvals",
    );
  });

  it("renders nothing for roles that cannot approve", () => {
    perms.clear();
    const { container } = renderWithIntl(<PendingApprovalsCard />);
    expect(container).toBeEmptyDOMElement();
  });
});
