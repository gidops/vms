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
vi.mock("@/data/admin/queries", () => ({
  useAdminVisits: () => ({
    isLoading: false,
    data: {
      items: rows,
      page: 1,
      pageSize: 10,
      total: rows.length,
      totalPages: 1,
    },
  }),
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

const rowOf = (name: string) =>
  screen.getByText(name).closest("tr") as HTMLElement;

describe("PendingApprovalsTable (v2)", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Deny Chidi Okonkwo" }));
    expect(onDeny).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Approve Fatima Nwosu" }),
    );
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "2" }));
  });

  it("hides Deny without visit:deny", () => {
    perms.add(PERMISSIONS.VISIT_APPROVE);
    setup();
    expect(
      screen.getByRole("button", { name: "Approve Chidi Okonkwo" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Deny Chidi Okonkwo" }),
    ).toBeNull();
  });

  it("gives read-only roles a single Review button", () => {
    setup();
    expect(screen.queryByRole("button", { name: /^Approve/ })).toBeNull();
    expect(
      within(rowOf("Chidi Okonkwo")).getByRole("button", { name: "Review" }),
    ).toBeInTheDocument();
  });
});
