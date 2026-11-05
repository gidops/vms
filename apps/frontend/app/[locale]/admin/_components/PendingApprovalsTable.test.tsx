import { fireEvent, screen, within } from "@testing-library/react";
import { PERMISSIONS } from "@vms/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VisitListItem } from "@/data/visits/visits.api";
import { renderWithIntl } from "@/test/render";
import { PendingApprovalsTable } from "./PendingApprovalsTable";

const perms = new Set<string>();
vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: (p: string) => perms.has(p) }),
}));

let rows: VisitListItem[] = [];
const useAdminVisits = vi.fn();
vi.mock("@/data/admin/queries", () => ({
  useAdminVisits: (params: unknown) => {
    useAdminVisits(params);
    return {
      isLoading: false,
      data: {
        items: rows,
        page: 1,
        pageSize: 10,
        total: rows.length,
        totalPages: 1,
      },
    };
  },
}));

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

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
    scheduledAt: null,
    isGroupVisit: false,
    groupSize: 1,
    visitor: { id: `v-${id}`, fullName: name, email: `${id}@x.com` },
    host: null,
    ...over,
  } as VisitListItem;
}

function setup() {
  const onOpen = vi.fn();
  const onDeny = vi.fn();
  renderWithIntl(
    <PendingApprovalsTable query={{}} onOpen={onOpen} onDeny={onDeny} />,
  );
  return { onOpen, onDeny };
}

// jsdom renders both the desktop table and the mobile cards; scope to one.
const table = () => screen.getByRole("table");
const cards = () => screen.getAllByRole("article");
const rowOf = (name: string) =>
  within(table()).getByText(name).closest("tr") as HTMLElement;

describe("PendingApprovalsTable", () => {
  beforeEach(() => {
    perms.clear();
    rows = [
      visit("1", "Chidi Okonkwo", 72),
      visit("2", "Fatima Nwosu", 12),
      visit("3", "Kwame Mensah", 30, { status: "REVIEW_REQUESTED" }),
    ];
  });

  it("shows how long each request has waited, red past an hour", () => {
    setup();
    const overdue = within(rowOf("Chidi Okonkwo")).getByText("1h 12m");
    expect(overdue).toBeInTheDocument();
    expect(within(rowOf("Fatima Nwosu")).getByText("12m")).toBeInTheDocument();
    expect(
      within(rowOf("Kwame Mensah")).getByText("More info asked"),
    ).toBeInTheDocument();
  });

  it("lets approvers approve or deny straight from the row", () => {
    perms.add(PERMISSIONS.VISIT_APPROVE);
    perms.add(PERMISSIONS.VISIT_DENY);
    const { onOpen, onDeny } = setup();
    fireEvent.click(
      within(table()).getByRole("button", { name: "Deny Chidi Okonkwo" }),
    );
    expect(onDeny).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
    fireEvent.click(
      within(table()).getByRole("button", { name: "Approve Fatima Nwosu" }),
    );
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "2" }));
  });

  it("hides Deny without visit:deny", () => {
    perms.add(PERMISSIONS.VISIT_APPROVE);
    setup();
    expect(
      within(table()).getByRole("button", { name: "Approve Chidi Okonkwo" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Deny Chidi Okonkwo" }),
    ).toBeNull();
  });

  it("shows each request as a card on small screens, with its waiting time and actions", () => {
    perms.add(PERMISSIONS.VISIT_APPROVE);
    perms.add(PERMISSIONS.VISIT_DENY);
    const { onOpen, onDeny } = setup();
    const [first, , third] = cards();
    expect(first).toHaveTextContent("Chidi Okonkwo");
    expect(within(first).getByText("1h 12m")).toBeInTheDocument();
    expect(third).toHaveTextContent("More info asked");
    fireEvent.click(
      within(first).getByRole("button", { name: "Deny Chidi Okonkwo" }),
    );
    expect(onDeny).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
    fireEvent.click(
      within(first).getByRole("button", {
        name: "View details for Chidi Okonkwo",
      }),
    );
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
  });

  it("gives read-only roles a single Review button", () => {
    setup();
    expect(screen.queryByRole("button", { name: /^Approve/ })).toBeNull();
    expect(
      within(rowOf("Chidi Okonkwo")).getByRole("button", { name: "Review" }),
    ).toBeInTheDocument();
  });
});

describe("PendingApprovalsTable — filter pills", () => {
  beforeEach(() => {
    perms.clear();
    rows = [];
    useAdminVisits.mockClear();
  });

  it("offers All, Info requested, Flagged and Group", () => {
    setup();
    const names = screen.getAllByRole("radio").map((r) => r.textContent);
    expect(names).toEqual(["All", "Info requested", "Flagged", "Group"]);
  });

  it("Group keeps the decision statuses and asks for group visits only", () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: "Group" }));
    expect(useAdminVisits).toHaveBeenLastCalledWith(
      expect.objectContaining({
        statuses: ["PENDING", "REVIEW_REQUESTED", "FLAGGED"],
        groupVisit: true,
      }),
    );
  });

  it("Info requested filters on that single status", () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: "Info requested" }));
    expect(useAdminVisits).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "REVIEW_REQUESTED" }),
    );
  });
});

describe("PendingApprovalsTable — dashboard (vmc) variant", () => {
  beforeEach(() => {
    perms.clear();
    rows = [visit("1", "Chidi Okonkwo", 72)];
  });

  it("titles the table like the VMC records table, with the status pills beside it", () => {
    renderWithIntl(
      <PendingApprovalsTable variant="vmc" query={{}} onOpen={vi.fn()} />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Pending Approvals" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByRole("radio", { name: "All" })).toBeChecked();
    expect(within(table()).getByText("Chidi Okonkwo")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Host / Floor" }),
    ).toBeInTheDocument();
    // No Waiting column on the dashboard.
    expect(screen.queryByRole("columnheader", { name: "Waiting" })).toBeNull();
    expect(screen.queryByText("1h 12m")).toBeNull();
    // The mobile card drops the dashboard's waiting time too.
    // Guest count as the bare number.
    const row = rowOf("Chidi Okonkwo");
    expect(within(row).getByText("1")).toBeInTheDocument();
    expect(within(row).queryByText(/guest/i)).toBeNull();
  });

  it("gives each row one outline button: Review to decide, View while with the host", () => {
    perms.add(PERMISSIONS.VISIT_APPROVE);
    perms.add(PERMISSIONS.VISIT_DENY);
    rows = [
      visit("1", "Chidi Okonkwo", 72),
      visit("2", "Kwame Mensah", 30, { status: "REVIEW_REQUESTED" }),
      visit("3", "Ada Group", 5, {
        isGroupVisit: true,
        groupId: "g1",
        groupName: "Ada Group",
      }),
    ];
    const onOpen = vi.fn();
    renderWithIntl(
      <PendingApprovalsTable variant="vmc" query={{}} onOpen={onOpen} />,
    );
    for (const name of ["Chidi Okonkwo", "Kwame Mensah", "Ada Group"]) {
      expect(within(rowOf(name)).getAllByRole("button")).toHaveLength(1);
    }
    expect(screen.queryByRole("button", { name: /Approve|Deny/ })).toBeNull();
    fireEvent.click(
      within(table()).getByRole("button", { name: "Review Chidi Okonkwo" }),
    );
    expect(onOpen).toHaveBeenCalledWith(rows[0]);
    expect(
      within(rowOf("Kwame Mensah")).getByRole("button", {
        name: "View Kwame Mensah",
      }),
    ).toHaveTextContent("View");
    expect(
      within(rowOf("Ada Group")).getByRole("button", {
        name: "Review Ada Group",
      }),
    ).toBeInTheDocument();
  });
});

describe("PendingApprovalsTable — full tab (page + review)", () => {
  beforeEach(() => {
    perms.clear();
    perms.add(PERMISSIONS.VISIT_APPROVE);
    perms.add(PERMISSIONS.VISIT_DENY);
    rows = [visit("1", "Chidi Okonkwo", 72, { groupSize: 3 })];
  });

  it("keeps Waiting, the guest icon with the word, and one Review button", () => {
    renderWithIntl(
      <PendingApprovalsTable query={{}} onOpen={vi.fn()} actions="review" />,
    );
    const row = rowOf("Chidi Okonkwo");
    expect(
      screen.getByRole("columnheader", { name: "Waiting" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Host / Floor / Unit" }),
    ).toBeInTheDocument();
    expect(within(row).getByText("1h 12m")).toBeInTheDocument();
    expect(within(row).getByText("3 Guests")).toBeInTheDocument();
    expect(within(row).getAllByRole("button")).toHaveLength(1);
    expect(
      within(row).getByRole("button", { name: "Review Chidi Okonkwo" }),
    ).toBeInTheDocument();
  });
});
