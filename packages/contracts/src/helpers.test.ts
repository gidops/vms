import { describe, expect, it } from "vitest";
import { auditCategoryOf } from "./audit/audit.schema";
import {
  homeFor,
  isAddonRole,
  ROLES,
  switchableRoles,
} from "./auth/rbac.schema";
import { normalizeE164, parsePhone, toE164 } from "./common/phone";
import { normalizeConsentEmail } from "./consent/consent.schema";
import { isPlainName, isPlainOrganization } from "./desk-qr/desk-qr.schema";
import { ExportVisitsQuery, inclusiveDaySpan } from "./report/report.schema";
import { evacuationAssistIssues } from "./visit/visit.schema";

describe("phone helpers", () => {
  it.each([
    ["+234 803 123 4567", "+2348031234567"],
    ["00234-803-123-4567", "+2348031234567"],
    ["+234 +2348031234567", "+2348031234567"],
    ["(0803) 123.4567", "08031234567"],
    ["", ""],
    [null, ""],
  ])("normalizeE164(%j) → %j", (raw, expected) => {
    expect(normalizeE164(raw)).toBe(expected);
  });

  it.each([
    ["+234", "08031234567", "+2348031234567"],
    ["+234", "2348031234567", "+2348031234567"],
    ["+1", "(202) 555-0100", "+12025550100"],
    ["+234", "000", ""],
  ])("toE164(%j, %j) → %j", (code, national, expected) => {
    expect(toE164(code, national)).toBe(expected);
  });

  it("parsePhone prefers the longest matching dial code", () => {
    expect(parsePhone("+12465550100", ["+1", "+1246"])).toEqual({
      code: "+1246",
      number: "5550100",
    });
    expect(parsePhone("+447700900123", ["+234", "+1"])).toEqual({
      code: "+234",
      number: "447700900123",
    });
    expect(parsePhone(null, ["+234"])).toEqual({ code: "+234", number: "" });
  });
});

describe("evacuationAssistIssues", () => {
  it("accepts no assistance with no types", () => {
    expect(evacuationAssistIssues({ needsEvacuationAssist: false })).toEqual(
      [],
    );
  });

  it("rejects types when no assistance is needed", () => {
    expect(
      evacuationAssistIssues({
        needsEvacuationAssist: false,
        evacuationAssistTypes: ["MOBILITY"],
      }).map(([path]) => path),
    ).toEqual(["evacuationAssistTypes"]);
  });

  it("requires a type, and a description for OTHER", () => {
    expect(
      evacuationAssistIssues({ needsEvacuationAssist: true }).map(([p]) => p),
    ).toEqual(["evacuationAssistTypes"]);
    expect(
      evacuationAssistIssues({
        needsEvacuationAssist: true,
        evacuationAssistTypes: ["OTHER"],
        evacuationAssistOther: "  ",
      }).map(([p]) => p),
    ).toEqual(["evacuationAssistOther"]);
    expect(
      evacuationAssistIssues({
        needsEvacuationAssist: true,
        evacuationAssistTypes: ["OTHER"],
        evacuationAssistOther: "Guide dog",
      }),
    ).toEqual([]);
  });
});

describe("role helpers", () => {
  it("sends each role to its home page, defaulting to the dashboard", () => {
    expect(homeFor(ROLES.SUPER_ADMIN)).toBe("/admin");
    expect(homeFor(ROLES.STAFF)).toBe("/staff");
    expect(homeFor(ROLES.GATE)).toBe("/gate");
    expect(homeFor(null)).toBe("/dashboard");
    expect(homeFor("UNKNOWN")).toBe("/dashboard");
  });

  it("never offers add-on roles in the role switcher", () => {
    expect(isAddonRole(ROLES.READ_ADMIN)).toBe(true);
    expect(isAddonRole(ROLES.STAFF)).toBe(false);
    expect(
      switchableRoles([ROLES.STAFF, ROLES.READ_ADMIN, ROLES.VMC_ADMIN]),
    ).toEqual([ROLES.STAFF]);
  });
});

describe("export range", () => {
  it("counts both ends of the range", () => {
    expect(inclusiveDaySpan("2026-10-01", "2026-10-01")).toBe(1);
    expect(inclusiveDaySpan("2026-10-01", "2026-10-31")).toBe(31);
  });

  it("rejects reversed and over-long ranges", () => {
    expect(
      ExportVisitsQuery.safeParse({ from: "2026-10-02", to: "2026-10-01" })
        .success,
    ).toBe(false);
    expect(
      ExportVisitsQuery.safeParse({ from: "2025-01-01", to: "2026-10-01" })
        .success,
    ).toBe(false);
    expect(
      ExportVisitsQuery.parse({ from: "2026-10-01", to: "2026-10-07" }).format,
    ).toBe("csv");
  });
});

describe("small normalisers", () => {
  it("maps audit actions to their category", () => {
    expect(auditCategoryOf("visit.approved")).toBe("visit");
    expect(auditCategoryOf("authz.permission_denied")).toBe("auth");
  });

  it("normalises consent emails", () => {
    expect(normalizeConsentEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });
});

describe("self-registration plain-text rules", () => {
  it.each([
    "Ada Obi",
    "Ngozi Okonjo-Iweala",
    "D'Souza",
    "Émilie Dubois",
    "محمد علي",
  ])("accepts the name %j", (name) => expect(isPlainName(name)).toBe(true));

  it.each([
    "Visit www.evil.com",
    "evil.com",
    "<b>Ada</b>",
    "http://x",
    "Ada 2",
  ])("rejects the name %j", (name) => expect(isPlainName(name)).toBe(false));

  it.each(["Dangote Group", "J.P. Morgan & Co. (Nigeria)", "Access Bank 2"])(
    "accepts the organisation %j",
    (org) => expect(isPlainOrganization(org)).toBe(true),
  );

  it.each(["acme.com", "Click https://x.y", "Acme <script>"])(
    "rejects the organisation %j",
    (org) => expect(isPlainOrganization(org)).toBe(false),
  );
});
