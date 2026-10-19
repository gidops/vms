import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { GuestBlock } from "./GuestBlock";
import { blankGuest, type GuestEntry } from "./guest-form";

function setup(
  over: Partial<GuestEntry> = {},
  props: Partial<React.ComponentProps<typeof GuestBlock>> = {},
) {
  const onChange = vi.fn();
  renderWithIntl(
    <GuestBlock
      value={{ ...blankGuest(), ...over }}
      index={0}
      mode="walkin"
      hosts={[
        {
          userId: "00000000-0000-4000-8000-000000000001",
          fullName: "Dr Alabi",
          email: "dr.alabi@aatc.org",
        } as never,
      ]}
      onUseSameChange={vi.fn()}
      showErrors={false}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange };
}

describe("GuestBlock — Safety & consent", () => {
  it("renders both required questions with nothing selected", () => {
    setup();
    expect(screen.getByText("Safety & consent")).toBeInTheDocument();
    const evac = screen.getByRole("radiogroup", {
      name: /Need help evacuating in an emergency\?/,
    });
    const consent = screen.getByRole("radiogroup", {
      name: /Get updates on Afreximbank events\?/,
    });
    for (const group of [evac, consent]) {
      const radios = group.querySelectorAll('[role="radio"]');
      expect(radios).toHaveLength(2);
      radios.forEach((r) => expect(r).toHaveAttribute("aria-checked", "false"));
    }
  });

  it("reports the answer through onChange", () => {
    const { onChange } = setup();
    const consent = screen.getByRole("radiogroup", {
      name: /Get updates on Afreximbank events\?/,
    });
    fireEvent.click(consent.querySelector('[role="radio"]:last-child')!);
    expect(onChange).toHaveBeenCalledWith({ commsConsent: false });
    const evac = screen.getByRole("radiogroup", {
      name: /Need help evacuating/,
    });
    fireEvent.click(evac.querySelector('[role="radio"]')!);
    expect(onChange).toHaveBeenCalledWith({ needsEvacuationAssist: true });
  });

  it("flags only the unanswered question after a submit attempt", () => {
    setup({ needsEvacuationAssist: true }, { showErrors: true });
    expect(screen.getAllByText("Choose Yes or No")).toHaveLength(1);
    const consent = screen.getByRole("radiogroup", {
      name: /Get updates on Afreximbank events\?/,
    });
    expect(consent).toHaveAttribute("aria-invalid", "true");
  });

  it("shows an optional host picker on walk-ins", () => {
    setup();
    expect(screen.getByText("Select Host/Staff")).toBeInTheDocument();
    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("marks the host required on invites", () => {
    setup({}, { mode: "invite" });
    expect(screen.queryByText("Optional")).not.toBeInTheDocument();
  });
});
