import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import type { VisitRequestDetail } from "@/data/visits/visits.api";
import { EditVisitForm } from "./EditVisitForm";

const mutate = vi.fn();
vi.mock("@/data/requests/queries", () => ({
  useUpdateVisit: () => ({ mutate, isPending: false }),
}));
vi.mock("@/data/hosts/queries", () => ({
  useHosts: () => ({ data: [] }),
}));

const detail = {
  id: "00000000-0000-4000-8000-0000000000aa",
  visitor: {
    fullName: "Sophia Davis",
    email: "sophia@example.com",
    phone: "",
    organization: "AMAC",
  },
  host: null,
  floor: "4th Floor",
  purpose: "Official",
  scheduledAt: null,
  needsEvacuationAssist: true,
  commsConsent: false,
} as unknown as VisitRequestDetail;

describe("EditVisitForm — safety answers", () => {
  beforeEach(() => mutate.mockReset());

  it("pre-fills the saved evacuation answer and hides comms consent", () => {
    renderWithIntl(<EditVisitForm detail={detail} onDone={vi.fn()} />);
    const evac = screen.getByRole("radiogroup", {
      name: /Need help evacuating/,
    });
    expect(evac.querySelector('[aria-checked="true"]')).toHaveTextContent(
      "Yes",
    );
    expect(
      screen.queryByRole("radiogroup", { name: /Get updates on Afreximbank/ }),
    ).not.toBeInTheDocument();
  });

  it("sends a changed evacuation answer on save", () => {
    renderWithIntl(<EditVisitForm detail={detail} onDone={vi.fn()} />);
    const evac = screen.getByRole("radiogroup", {
      name: /Need help evacuating/,
    });
    fireEvent.click(evac.querySelector('[role="radio"]:last-child')!);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ needsEvacuationAssist: false }),
      expect.anything(),
    );
  });

  it("leaves an older Yes alone when only other details change", () => {
    // Saved before assistance types existed: Yes, but no types.
    renderWithIntl(<EditVisitForm detail={detail} onDone={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Full name/), {
      target: { value: "Sophia D. Davis" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const payload = mutate.mock.calls[0][0];
    expect(payload.fullName).toBe("Sophia D. Davis");
    expect(payload).not.toHaveProperty("needsEvacuationAssist");
    expect(payload).not.toHaveProperty("evacuationAssistTypes");
  });

  it("requires an assistance type before saving a new Yes", () => {
    renderWithIntl(
      <EditVisitForm
        detail={{ ...detail, needsEvacuationAssist: false }}
        onDone={vi.fn()}
      />,
    );
    const evac = screen.getByRole("radiogroup", {
      name: /Need help evacuating/,
    });
    fireEvent.click(evac.querySelector('[role="radio"]')!);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(mutate).not.toHaveBeenCalled();
    expect(
      screen.getByText("Choose the type of assistance needed"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Mobility assistance/));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        needsEvacuationAssist: true,
        evacuationAssistTypes: ["MOBILITY"],
      }),
      expect.anything(),
    );
  });
});
