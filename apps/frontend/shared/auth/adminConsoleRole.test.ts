import { PERMISSIONS } from "@vms/contracts";
import { describe, expect, it } from "vitest";
import { bandStatKeys } from "@/app/[locale]/admin/v2/_components/useAdminBand";
import { adminConsoleRole } from "./adminConsoleRole";

const holds =
  (...perms: string[]) =>
  (p: string) =>
    perms.includes(p);

describe("admin console by role", () => {
  it("gives an approver without user:read the Security Manager console", () => {
    expect(adminConsoleRole(holds(PERMISSIONS.VISIT_APPROVE))).toBe(
      "securityManager",
    );
  });

  it("gives a holder of every permission the System Admin console", () => {
    expect(
      adminConsoleRole(holds(PERMISSIONS.VISIT_APPROVE, PERMISSIONS.USER_READ)),
    ).toBe("systemAdmin");
  });

  it("shows three stats each: approvals first for the SM, traffic for the SA", () => {
    expect(bandStatKeys("securityManager")).toEqual([
      "awaiting",
      "visitorsToday",
      "onsite",
    ]);
    expect(bandStatKeys("systemAdmin")).toEqual([
      "visitorsToday",
      "onsite",
      "checkedOut",
    ]);
  });
});
