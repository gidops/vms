import { describe, expect, it } from "vitest";
import { countOverdue, waitingMinutes } from "./pendingApprovals";

const now = new Date("2026-10-27T12:00:00.000Z");
const ago = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

describe("waitingMinutes", () => {
  it("counts whole minutes and never goes negative", () => {
    expect(waitingMinutes(ago(90.5), now)).toBe(90);
    expect(waitingMinutes(ago(-5), now)).toBe(0);
  });
});

describe("countOverdue", () => {
  it("counts only PENDING requests waiting an hour or more", () => {
    expect(
      countOverdue(
        [
          { status: "PENDING", createdAt: ago(60) },
          { status: "PENDING", createdAt: ago(59) },
          { status: "REVIEW_REQUESTED", createdAt: ago(300) },
        ],
        now,
      ),
    ).toBe(1);
  });
});
