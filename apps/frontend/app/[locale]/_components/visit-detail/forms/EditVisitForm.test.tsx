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
});
