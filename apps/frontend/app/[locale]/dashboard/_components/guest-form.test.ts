import { describe, expect, it } from "vitest";
import {
  blankGuest,
  buildCreateInput,
  guestComplete,
  safetyConsentValid,
  visitDetailFields,
  visitDetailsValid,
  type GuestEntry,
} from "./guest-form";

const HOST = "00000000-0000-4000-8000-000000000001";
const filled = (over: Partial<GuestEntry> = {}): GuestEntry => ({
  ...blankGuest(),
  fullName: "Ifeoma Chukwu",
  email: "ifeoma.chukwu@gtbank.com",
  organization: "Guaranty Trust Bank",
  phoneNumber: "8035521904",
  floor: "4th Floor",
  purpose: "Official",
  needsEvacuationAssist: true,
  commsConsent: false,
  ...over,
});
const noGroup = { isGroupVisit: false, groupName: "", groupContact: "" };

describe("guest-form safety & consent", () => {
  it("starts both questions unanswered (no default)", () => {
    const g = blankGuest();
    expect(g.needsEvacuationAssist).toBeNull();
    expect(g.commsConsent).toBeNull();
    expect(safetyConsentValid(g)).toBe(false);
  });

  it("blocks a guest until both questions are answered", () => {
    expect(guestComplete(filled({ commsConsent: null }), "walkin")).toBe(false);
    expect(
      guestComplete(filled({ needsEvacuationAssist: null }), "walkin"),
    ).toBe(false);
    expect(guestComplete(filled(), "walkin")).toBe(true);
    // "No" is a real answer, not a missing one.
    expect(
      guestComplete(
        filled({ needsEvacuationAssist: false, commsConsent: false }),
        "walkin",
      ),
    ).toBe(true);
  });

  it("never copies the answers with 'Use same visit details'", () => {
    const fields = visitDetailFields(filled());
    expect(fields).not.toHaveProperty("needsEvacuationAssist");
    expect(fields).not.toHaveProperty("commsConsent");
  });

  it("sends both answers per guest", () => {
    const input = buildCreateInput(
      [filled(), filled({ email: "b@x.com", commsConsent: true })],
      "walkin",
      noGroup,
    );
    expect(
      input.guests.map((g) => [g.needsEvacuationAssist, g.commsConsent]),
    ).toEqual([
      [true, false],
      [true, true],
    ]);
  });

  it("refuses to turn an unanswered question into a silent No", () => {
    expect(() =>
      buildCreateInput([filled({ commsConsent: null })], "walkin", noGroup),
    ).toThrow();
  });
});

describe("guest-form optional walk-in host", () => {
  it("does not require a host for walk-ins but does for invites", () => {
    expect(visitDetailsValid(filled(), "walkin")).toBe(true);
    expect(
      visitDetailsValid(
        filled({ scheduledDate: "2026-10-20", scheduledTime: "10:00" }),
        "invite",
      ),
    ).toBe(false);
  });

  it("passes a chosen walk-in host through (it used to be dropped)", () => {
    const withHost = buildCreateInput(
      [filled({ hostUserId: HOST })],
      "walkin",
      noGroup,
    );
    expect(withHost.type).toBe("WALK_IN");
    expect(withHost.guests[0].hostUserId).toBe(HOST);
    expect(withHost.guests[0].scheduledAt).toBeUndefined();
    const without = buildCreateInput([filled()], "walkin", noGroup);
    expect(without.guests[0].hostUserId).toBeUndefined();
  });
});
