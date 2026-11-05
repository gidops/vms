import { fireEvent, render, screen } from "@testing-library/react";
import { Label, PasswordInput } from "@vms/ui";
import { describe, expect, it } from "vitest";

describe("PasswordInput", () => {
  it("hides the password until the eye toggle is pressed, and hides it again", () => {
    render(
      <>
        <Label htmlFor="pw">Password</Label>
        <PasswordInput id="pw" defaultValue="Passw0rd!" />
      </>,
    );
    const field = screen.getByLabelText("Password");
    expect(field).toHaveAttribute("type", "password");

    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("type", "button");
    fireEvent.click(toggle);
    expect(field).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Hide password" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(field).toHaveAttribute("type", "password");
  });
});
