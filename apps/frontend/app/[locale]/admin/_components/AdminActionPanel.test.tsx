import { fireEvent, screen } from "@testing-library/react";
import { PERMISSIONS } from "@vms/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { AdminActionPanel } from "./AdminActionPanel";

const perms = new Set<string>();
const push = vi.fn();
vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: (p: string) => perms.has(p) }),
}));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/app/[locale]/_components/EvacuationIndicator", () => ({
  useEvacuationAlertCount: () => 0,
  EvacuationRollLink: () => null,
}));

// Accessible names: the visible text also carries the short mobile label.
const buttons = () =>
  screen
    .getAllByRole("button")
    .map((b) => b.getAttribute("aria-label") ?? b.textContent?.trim());

describe("AdminActionPanel", () => {
  beforeEach(() => {
    perms.clear();
    push.mockReset();
  });

  it("gives the Security Manager Review Requests and Visit History, no Export", () => {
    perms.add(PERMISSIONS.VISIT_APPROVE);
    perms.add(PERMISSIONS.HISTORY_READ);
    perms.add(PERMISSIONS.REPORT_EXPORT);
    renderWithIntl(<AdminActionPanel onAddVisitor={vi.fn()} />);
    expect(buttons()).toEqual(["Review Requests", "Visit History"]);
    fireEvent.click(screen.getByRole("button", { name: "Review Requests" }));
    expect(push).toHaveBeenCalledWith("/admin/approvals");
    fireEvent.click(screen.getByRole("button", { name: "Visit History" }));
    expect(push).toHaveBeenCalledWith({
      pathname: "/insights",
      query: { tab: "history" },
    });
  });

  it("gives the System Admin Add Visitor and Review Requests", () => {
    for (const p of Object.values(PERMISSIONS)) perms.add(p);
    const onAddVisitor = vi.fn();
    renderWithIntl(<AdminActionPanel onAddVisitor={onAddVisitor} />);
    expect(buttons()).toEqual(["Add Visitor", "Review Requests"]);
    fireEvent.click(screen.getByRole("button", { name: "Review Requests" }));
    expect(push).toHaveBeenCalledWith("/admin/approvals");
    fireEvent.click(screen.getByRole("button", { name: "Add Visitor" }));
    expect(onAddVisitor).toHaveBeenCalled();
  });
});
