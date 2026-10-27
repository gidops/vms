import { fireEvent, render, screen } from "@testing-library/react";
import { SegmentedControl } from "@vms/ui";
import { describe, expect, it, vi } from "vitest";

const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

describe("SegmentedControl (@vms/ui)", () => {
  it("defaults to the first option when uncontrolled", () => {
    render(<SegmentedControl options={yesNo} aria-label="Q" />);
    expect(screen.getByRole("radio", { name: "Yes" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("can start unanswered, with one tab stop and a required flag", () => {
    render(
      <SegmentedControl options={yesNo} value={null} required aria-label="Q" />,
    );
    const [yes, no] = screen.getAllByRole("radio");
    expect(yes).toHaveAttribute("aria-checked", "false");
    expect(no).toHaveAttribute("aria-checked", "false");
    expect(yes).toHaveAttribute("tabindex", "0");
    expect(no).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("radiogroup")).toHaveAttribute(
      "aria-required",
      "true",
    );
  });

  it("never answers a question just because an arrow key was pressed", () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        options={yesNo}
        value={null}
        onValueChange={onValueChange}
      />,
    );
    const yes = screen.getByRole("radio", { name: "Yes" });
    yes.focus();
    fireEvent.keyDown(yes, { key: "ArrowRight" });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: "No" })).toHaveFocus();
  });

  it("moves and selects with arrow keys once answered", () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        options={yesNo}
        value="no"
        onValueChange={onValueChange}
      />,
    );
    const no = screen.getByRole("radio", { name: "No" });
    expect(no).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(no, { key: "ArrowLeft" });
    expect(onValueChange).toHaveBeenLastCalledWith("yes");
    fireEvent.click(no);
    expect(onValueChange).toHaveBeenLastCalledWith("no");
  });

  it("exposes the invalid and disabled states", () => {
    render(<SegmentedControl options={yesNo} value={null} invalid disabled />);
    expect(screen.getByRole("radiogroup")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Yes" })).toBeDisabled();
  });
});
