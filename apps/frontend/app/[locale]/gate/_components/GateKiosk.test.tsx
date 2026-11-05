import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/data/http/client";
import { renderWithIntl } from "@/test/render";
import { GateKiosk } from "./GateKiosk";

const verify = vi.fn();
vi.mock("@/data/gate/gate.api", () => ({
  gateApi: { verify: (...args: unknown[]) => verify(...args) },
}));

// The camera can't run in jsdom: a button stands in for a decoded QR.
const scannerPaused = vi.fn();
vi.mock("./GateScanner", () => ({
  GateScanner: ({
    paused,
    onCode,
  }: {
    paused: boolean;
    onCode: (payload: string) => void;
  }) => {
    scannerPaused(paused);
    return (
      <button type="button" onClick={() => onCode("WXYZ-789")}>
        fake scan
      </button>
    );
  },
}));

const onRevoked = vi.fn();

beforeEach(() => {
  verify.mockReset();
  onRevoked.mockReset();
  scannerPaused.mockReset();
});

describe("GateKiosk", () => {
  it("checks a scanned code and shows the verdict, then scans again", async () => {
    verify.mockResolvedValue({ verdict: "NOT_FOUND", visit: null });
    renderWithIntl(
      <GateKiosk token="kiosk-token-0001" onRevoked={onRevoked} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "fake scan" }));

    expect(
      await screen.findByRole("heading", { name: "No invitation found" }),
    ).toBeInTheDocument();
    expect(verify).toHaveBeenCalledWith("kiosk-token-0001", "WXYZ-789", "scan");
    expect(scannerPaused).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Scan next" }));
    expect(
      screen.getByRole("heading", { name: "Scan invitation" }),
    ).toBeInTheDocument();
    expect(scannerPaused).toHaveBeenLastCalledWith(false);
  });

  it("normalises a typed code before checking it", async () => {
    verify.mockResolvedValue({
      verdict: "VALID_TODAY",
      visit: {
        visitorName: "Ada Lovelace",
        organization: null,
        hostName: null,
        scheduledAt: new Date().toISOString(),
        status: "APPROVED",
      },
    });
    renderWithIntl(
      <GateKiosk token="kiosk-token-0001" onRevoked={onRevoked} />,
    );

    fireEvent.change(screen.getByLabelText("Invitation code"), {
      target: { value: "abcd 123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check code" }));

    await waitFor(() =>
      expect(verify).toHaveBeenCalledWith(
        "kiosk-token-0001",
        "ABCD-123",
        "manual",
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "Visit confirmed for today" }),
    ).toBeInTheDocument();
  });

  it("rejects a typed code that isn't code-shaped without calling the server", () => {
    renderWithIntl(
      <GateKiosk token="kiosk-token-0001" onRevoked={onRevoked} />,
    );
    fireEvent.change(screen.getByLabelText("Invitation code"), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check code" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Codes look like ABCD-123.",
    );
    expect(verify).not.toHaveBeenCalled();
  });

  it("explains a failed check and stays on the scanner", async () => {
    verify.mockRejectedValue(new Error("offline"));
    renderWithIntl(
      <GateKiosk token="kiosk-token-0001" onRevoked={onRevoked} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "fake scan" }));
    expect(
      await screen.findByText("Could not check this code. Try again."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Scan invitation" }),
    ).toBeInTheDocument();
  });

  it("reports a rotated or disabled kiosk link", async () => {
    verify.mockRejectedValue(new ApiError(404, "not active", {}));
    renderWithIntl(
      <GateKiosk token="kiosk-token-0001" onRevoked={onRevoked} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "fake scan" }));
    await waitFor(() => expect(onRevoked).toHaveBeenCalled());
  });
});
