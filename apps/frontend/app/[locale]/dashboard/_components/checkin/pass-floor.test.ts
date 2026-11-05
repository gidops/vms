import { describe, expect, it } from "vitest";
import { passesForFloor, passServesFloor } from "./pass-floor";

describe("passServesFloor", () => {
  it("matches a wingless pass zone to either wing of that floor", () => {
    expect(passServesFloor("2nd Floor", "2nd Floor - Left Wing")).toBe(true);
    expect(passServesFloor("4th Floor", "4th Floor - Right Wing")).toBe(true);
  });

  it("requires the wing to match when the pass zone names one", () => {
    expect(
      passServesFloor("5th Floor - left wing", "5th Floor - Left Wing"),
    ).toBe(true);
    expect(
      passServesFloor("5th Floor - left wing", "5th Floor - Right Wing"),
    ).toBe(false);
    expect(passServesFloor("3rd Floor - LW", "3rd Floor - Left Wing")).toBe(
      true,
    );
    expect(passServesFloor("3rd Floor - LW", "3rd Floor - Right Wing")).toBe(
      false,
    );
  });

  it("matches named levels and rejects other floors", () => {
    expect(passServesFloor("Ground Floor", "Ground Floor")).toBe(true);
    expect(passServesFloor("Floor Mezzanine", "Mezzanine")).toBe(true);
    expect(passServesFloor("Rooftop", "Rooftop")).toBe(true);
    expect(passServesFloor("1st Floor", "Ground Floor")).toBe(false);
    expect(passServesFloor("1st Floor", "11th Floor")).toBe(false);
  });

  it("does not match names it cannot read", () => {
    expect(passServesFloor("Lobby", "Lobby")).toBe(false);
  });
});

describe("passesForFloor", () => {
  const cards = [
    { id: "a", zone: "2nd Floor" },
    { id: "b", zone: "5th Floor - left wing" },
    { id: "c", zone: "5th Floor - right wing" },
  ];

  it("keeps only the passes for the visit's floor", () => {
    expect(passesForFloor(cards, "5th Floor - Right Wing")).toEqual({
      cards: [cards[2]],
      fallback: false,
    });
  });

  it("falls back to every pass when none serve the floor", () => {
    expect(passesForFloor(cards, "7th Floor - Left Wing")).toEqual({
      cards,
      fallback: true,
    });
  });

  it("falls back to every pass when the visit has no floor", () => {
    expect(passesForFloor(cards, null)).toEqual({ cards, fallback: true });
  });

  it("reports no fallback when there are no passes at all", () => {
    expect(passesForFloor([], "2nd Floor - Left Wing")).toEqual({
      cards: [],
      fallback: false,
    });
  });
});
