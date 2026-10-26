import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { addDaysIso, watTodayIso } from "@/shared/wat";
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
  it("exports the default range (the last week, WAT) as Excel", async () => {
    const to = watTodayIso();
    const from = addDaysIso(to, -6);
    const onOpenChange = vi.fn();
    renderWithIntl(<ExportVisitorsDialog open onOpenChange={onOpenChange} />);
    expect(screen.getByText("Export Visitor Data")).toBeInTheDocument();
    expect(screen.queryByText(/Up to 366 days/)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Excel" }));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() =>
      expect(exportVisits).toHaveBeenCalledWith({
        from,
        to,
        format: "xlsx",
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("exports the last 3 months as a PDF", async () => {
    const to = watTodayIso();
    renderWithIntl(<ExportVisitorsDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Last 3 months" }));
    fireEvent.click(screen.getByRole("radio", { name: "PDF" }));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await waitFor(() =>
      expect(exportVisits).toHaveBeenCalledWith({
        from: addDaysIso(to, -89),
        to,
        format: "pdf",
      }),
    );
  });

  it("labels the range trigger with the chosen days", () => {
    renderWithIntl(<ExportVisitorsDialog open onOpenChange={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /Date range/ });
    // Two calendar days, formatted for the locale ("Oct 17, 2026 – Oct 18, 2026").
    expect(trigger).toHaveTextContent(
      /\w{3} \d{1,2}, \d{4} – \w{3} \d{1,2}, \d{4}/,
    );
  });

  it("opens the dashboard range calendar from the date-range field", async () => {
    renderWithIntl(<ExportVisitorsDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Date range/ }));
    expect(
      await screen.findByRole("application", { name: /Date range/ }),
    ).toBeInTheDocument();
  });

  it("shows an error and keeps the dialog open when the export fails", async () => {
    exportVisits.mockRejectedValueOnce(new Error("boom"));
    const onOpenChange = vi.fn();
    renderWithIntl(<ExportVisitorsDialog open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(
      await screen.findByText("The export failed. Please try again."),
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
