import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GateResult as GateResultData } from "@/data/gate/gate.api";
import { renderWithIntl } from "@/test/render";
import { AUTO_RETURN_SECONDS, GateResult } from "./GateResult";

const visit = (scheduledAt: string | null = new Date().toISOString()) => ({
  visitorName: "Ada Lovelace",
  organization: "Acme",
  hostName: "Dr Alabi",
  scheduledAt,
  status: "APPROVED" as const,
});

const show = (result: GateResultData, onDone = vi.fn()) => {
  renderWithIntl(<GateResult result={result} onDone={onDone} />);
  return onDone;
};

afterEach(() => vi.useRealTimers());

describe("GateResult", () => {
  it("confirms a visit today and shows who and whom they visit", () => {
    show({ verdict: "VALID_TODAY", visit: visit() });
    expect(
      screen.getByRole("heading", { name: "Visit confirmed for today" }),
    ).toHaveFocus();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Dr Alabi")).toBeInTheDocument();
  });

  it("tells a visitor who came early the day their visit is", () => {
    show({
      verdict: "WRONG_DAY",
      visit: visit(new Date(Date.now() + 3 * 86_400_000).toISOString()),
    });
    expect(screen.getByRole("heading", { name: "No visit today" }));
    expect(screen.getByText(/^Their visit is scheduled for /)).toBeVisible();
  });

  it("tells a visitor who came late the day their visit was", () => {
    show({
      verdict: "WRONG_DAY",
      visit: visit(new Date(Date.now() - 3 * 86_400_000).toISOString()),
    });
    expect(screen.getByText(/^Their visit was on /)).toBeVisible();
  });

  it.each([
    ["ALREADY_CHECKED_IN", "Already checked in"],
    ["NOT_CONFIRMED", "Visit not confirmed yet"],
    ["CLOSED", "Invitation no longer valid"],
  ] as const)("titles %s", (verdict, title) => {
    show({ verdict, visit: visit() });
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  });

  it("shows no visitor details for an unknown code", () => {
    show({ verdict: "NOT_FOUND", visit: null });
    expect(
      screen.getByRole("heading", { name: "No invitation found" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Host")).not.toBeInTheDocument();
  });

  it("returns to scanning on demand", () => {
    const onDone = show({ verdict: "NOT_FOUND", visit: null });
    fireEvent.click(screen.getByRole("button", { name: "Scan next" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("returns to scanning by itself after the countdown", () => {
    vi.useFakeTimers();
    const onDone = show({ verdict: "VALID_TODAY", visit: visit() });
    act(() => vi.advanceTimersByTime(AUTO_RETURN_SECONDS * 1000));
    expect(onDone).toHaveBeenCalled();
  });
});
