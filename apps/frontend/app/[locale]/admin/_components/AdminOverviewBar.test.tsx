import { fireEvent, screen, within } from "@testing-library/react";
import { PERMISSIONS } from "@vms/contracts";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { AdminOverviewBar, dayPart } from "./AdminOverviewBar";

const perms = new Set<string>();
vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({
    hasPermission: (p: string) => perms.has(p),
    user: { fullName: "Amina Bello" },
    activeRole: "ADMIN",
  }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
let statsQuery: {
  isLoading: boolean;
  isError: boolean;
  data?: Record<string, number>;
};
vi.mock("@/data/admin/queries", () => ({
  useAdminOverviewStats: () => statsQuery,
}));
vi.mock("@/data/requests/queries", () => ({
  usePendingVisits: () => ({
    data: {
      items: [
        { createdAt: new Date(Date.now() - 90 * 60_000).toISOString() },
        { createdAt: new Date(Date.now() - 5 * 60_000).toISOString() },
      ],
    },
  }),
}));

const desktop = () => within(screen.getByTestId("overview-bar-desktop"));

describe("AdminOverviewBar", () => {
  beforeEach(() => {
    perms.clear();
    statsQuery = {
      isLoading: false,
      isError: false,
      data: { pending: 7, onsite: 23, expected: 41 },
    };
  });

  it("shows Awaiting approval as the hero, then Onsite now and Expected today", () => {
    renderWithIntl(<AdminOverviewBar onAddVisitor={vi.fn()} />);
    const bar = desktop();
    expect(bar.getByText("Security Manager")).toBeInTheDocument();
    const labels = ["Awaiting approval", "Onsite now", "Expected today"];
    for (const l of labels) expect(bar.getByText(l)).toBeInTheDocument();
    expect(
      bar.getByText("Awaiting approval").closest("[data-tone]"),
    ).toHaveAttribute("data-tone", "warning");
    expect(bar.getByText("7")).toBeInTheDocument();
    expect(bar.getByText("23")).toBeInTheDocument();
    expect(bar.getByText("41")).toBeInTheDocument();
    expect(bar.getByText("1 waiting over 1 hour")).toBeInTheDocument();
  });

  it("gates the quick actions and opens the export dialog", () => {
    perms.add(PERMISSIONS.VISIT_APPROVE);
    perms.add(PERMISSIONS.INVITATION_CREATE);
    perms.add(PERMISSIONS.REPORT_EXPORT);
    const onAdd = vi.fn();
    renderWithIntl(<AdminOverviewBar onAddVisitor={onAdd} />);
    const bar = desktop();
    expect(bar.getByRole("link", { name: "Review approvals" })).toHaveAttribute(
      "href",
      "/admin/requests",
    );
    fireEvent.click(bar.getByRole("button", { name: "Add visitor" }));
    expect(onAdd).toHaveBeenCalled();
    fireEvent.click(bar.getByRole("button", { name: "Export" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Export Visitor Data");
  });

  it("shows a read-only note when no action is allowed", () => {
    renderWithIntl(<AdminOverviewBar onAddVisitor={vi.fn()} />);
    const bar = desktop();
    expect(bar.queryByRole("button")).toBeNull();
    expect(bar.getByText("Read-only access")).toBeInTheDocument();
  });

  it("shows placeholders while loading and an alert on error", () => {
    statsQuery = { isLoading: true, isError: false };
    const { unmount } = renderWithIntl(
      <AdminOverviewBar onAddVisitor={vi.fn()} />,
    );
    expect(desktop().getAllByText("—")).toHaveLength(3);
    unmount();
    statsQuery = { isLoading: false, isError: true };
    renderWithIntl(<AdminOverviewBar onAddVisitor={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load");
  });

  it("picks the greeting by hour", () => {
    expect(dayPart(new Date(2026, 9, 19, 9))).toBe("morning");
    expect(dayPart(new Date(2026, 9, 19, 14))).toBe("afternoon");
    expect(dayPart(new Date(2026, 9, 19, 19))).toBe("evening");
  });
});
