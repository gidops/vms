import { fireEvent, render, screen } from "@testing-library/react";
import { YesNoControl } from "@vms/ui";
import { describe, expect, it, vi } from "vitest";

describe("YesNoControl (@vms/ui)", () => {
  it("starts unanswered with Yes as the tab stop", () => {
    render(
      <YesNoControl
        value={null}
        onValueChange={vi.fn()}
        yesLabel="Yes"
        noLabel="No"
        aria-label="Q"
      />,
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

  it("selects with click and arrow keys", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <YesNoControl
        value={null}
        onValueChange={onValueChange}
        yesLabel="Yes"
        noLabel="No"
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    expect(onValueChange).toHaveBeenLastCalledWith(false);
    rerender(
      <YesNoControl
        value={false}
        onValueChange={onValueChange}
        yesLabel="Yes"
        noLabel="No"
      />,
    );
    expect(screen.getByRole("radio", { name: "No" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.keyDown(screen.getByRole("radio", { name: "No" }), {
      key: "ArrowLeft",
    });
    expect(onValueChange).toHaveBeenLastCalledWith(true);
  });

  it("exposes the invalid state", () => {
    render(
      <YesNoControl
        value={null}
        onValueChange={vi.fn()}
        yesLabel="Yes"
        noLabel="No"
        invalid
      />,
    );
    expect(screen.getByRole("radiogroup")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
