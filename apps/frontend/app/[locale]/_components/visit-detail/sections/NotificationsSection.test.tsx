import type { NotificationDelivery } from "@vms/contracts";
import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { NotificationsSection, templateLabelKey } from "./NotificationsSection";

const perms = new Set<string>();
const retry = vi.fn();
let rows: NotificationDelivery[] = [];
vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: (p: string) => perms.has(p) }),
}));
vi.mock("@/data/deliveries/queries", () => ({
  useVisitDeliveries: () => ({ data: rows, isLoading: false, isError: false }),
  useRetryDelivery: () => ({
    mutate: retry,
    isPending: false,
    isError: false,
    variables: undefined,
  }),
}));

const d = (over: Partial<NotificationDelivery>): NotificationDelivery => ({
  id: "n1",
  channel: "EMAIL",
  templateKey: "visit.approved",
  recipientMasked: "c***@ecobank.com",
  status: "SENT",
  attempts: 1,
  error: null,
  sentAt: new Date("2026-10-18T08:12:00Z"),
  createdAt: new Date("2026-10-18T08:12:00Z"),
  ...over,
});

describe("NotificationsSection", () => {
  beforeEach(() => {
    perms.clear();
    retry.mockReset();
    rows = [
      d({ id: "e" }),
      d({ id: "w", channel: "WHATSAPP", recipientMasked: "+234 ***420" }),
      d({
        id: "s",
        channel: "SMS",
        recipientMasked: "+234 ***420",
        status: "FAILED",
        attempts: 3,
        error: "Number rejected by carrier",
        sentAt: null,
        createdAt: new Date("2026-10-18T08:13:00Z"),
      }),
    ];
  });

  it("lists each channel with Sent / Failed chips — never 'Delivered'", () => {
    renderWithIntl(<NotificationsSection visitId="v1" />);
    expect(screen.getByText("1 failed")).toBeInTheDocument();
    expect(screen.getAllByText("Sent")).toHaveLength(2);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.queryByText(/Delivered/i)).toBeNull();
    expect(screen.getAllByText(/Invite code/)).toHaveLength(3);
    // WAT time: 08:12 UTC → 09:12 Lagos.
    expect(
      screen.getByText("c***@ecobank.com · 18 Oct, 09:12"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Number rejected by carrier · 3 attempts"),
    ).toBeInTheDocument();
  });

  it("offers Retry only on failures, and only with notification:retry", () => {
    renderWithIntl(<NotificationsSection visitId="v1" />);
    expect(screen.queryByRole("button", { name: /Retry/ })).toBeNull();
  });

  it("retries the failed message", () => {
    perms.add("notification:retry");
    renderWithIntl(<NotificationsSection visitId="v1" />);
    const buttons = screen.getAllByRole("button", { name: /Retry/ });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(retry).toHaveBeenCalledWith("s");
  });

  it("maps template keys", () => {
    expect(templateLabelKey("visitor.arrived")).toBe("visitorArrived");
    expect(templateLabelKey("visit.thank_you")).toBe("thankYou");
    expect(templateLabelKey("nope")).toBe("other");
  });
});
