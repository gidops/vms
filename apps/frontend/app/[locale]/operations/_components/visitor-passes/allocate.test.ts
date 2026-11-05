import { describe, expect, it } from "vitest";
import { allocatePasses } from "./allocate";

const rows = [
  { zone: "Ground Floor", visits: 50 },
  { zone: "3rd Floor - Left Wing", visits: 30 },
  { zone: "3rd Floor - Right Wing", visits: 20 },
  { zone: "Rooftop", visits: 0 },
];

const sum = (o: Record<string, number>) =>
  Object.values(o).reduce((a, b) => a + b, 0);

describe("allocatePasses", () => {
  it("splits the total by each floor-wing's share of visits", () => {
    expect(allocatePasses(100, rows)).toEqual({
      "Ground Floor": 50,
      "3rd Floor - Left Wing": 30,
      "3rd Floor - Right Wing": 20,
      Rooftop: 0,
    });
  });

  it("always adds up to the total, rounding by largest remainder", () => {
    const out = allocatePasses(7, rows);
    expect(sum(out)).toBe(7);
    expect(out).toEqual({
      "Ground Floor": 4,
      "3rd Floor - Left Wing": 2,
      "3rd Floor - Right Wing": 1,
      Rooftop: 0,
    });
  });

  it("gives floors with no visits nothing", () => {
    expect(allocatePasses(10, rows).Rooftop).toBe(0);
  });

  it("splits evenly when no visits were recorded at all", () => {
    const quiet = rows.map((r) => ({ ...r, visits: 0 }));
    const out = allocatePasses(10, quiet);
    expect(sum(out)).toBe(10);
    expect(Object.values(out).sort()).toEqual([2, 2, 3, 3]);
  });

  it("returns zeros for a zero total", () => {
    expect(sum(allocatePasses(0, rows))).toBe(0);
  });
});
