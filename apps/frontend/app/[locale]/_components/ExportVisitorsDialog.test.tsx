import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { ExportVisitorsDialog, exportRangeError } from "./ExportVisitorsDialog";

const exportVisits = vi.fn().mockResolvedValue({ filename: "x", size: 1 });
vi.mock("@/data/reports/reports.api", () => ({
  reportsApi: { exportVisits: (q: unknown) => exportVisits(q) },
}));

describe("exportRangeError", () => {
  it("allows up to 366 days inclusive", () => {
    expect(exportRangeError("2026-10-17", "2026-10-17")).toBeNull();
    expect(exportRangeError("2025-01-02", "2026-01-02")).toBeNull();
    expect(exportRangeError("2025-01-01", "2026-01-02")).toBe("tooLong");
    expect(exportRangeError("2026-10-18", "2026-10-17")).toBe("order");
    expect(exportRangeError("", "2026-10-17")).toBe("missing");
  });
});

describe("ExportVisitorsDialog", () => {
  it("exports the chosen range as Excel", async () => {
    const onOpenChange = vi.fn();
    renderWithIntl(<ExportVisitorsDialog open onOpenChange={onOpenChange} />);
    expect(screen.getByText("Export Visitor Data")).toBeInTheDocument();
    expect(
      screen.getByText("By visit date, WAT. Up to 366 days."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "2026-10-17" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Excel" }));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() =>
      expect(exportVisits).toHaveBeenCalledWith({
        from: "2026-10-01",
        to: "2026-10-17",
        format: "xlsx",
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("blocks a range longer than 366 days", () => {
    renderWithIntl(<ExportVisitorsDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "2024-01-01" },
    });
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "2026-01-01" },
    });
    expect(
      screen.getByText("Pick a range of 366 days or less."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
  });
});
