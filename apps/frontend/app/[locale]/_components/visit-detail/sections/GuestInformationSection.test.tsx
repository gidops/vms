import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { VisitRequestDetail } from "@/data/visits/visits.api";
import { renderWithIntl } from "@/test/render";
import { GuestInformationSection } from "./GuestInformationSection";

const visit = (over: Partial<VisitRequestDetail> = {}): VisitRequestDetail =>
  ({
    id: "v1",
    status: "APPROVED",
    visitor: {
      id: "vis1",
      fullName: "Someone Else",
      email: "known@x.com",
      organization: "Other Ltd",
    },
    notes: [],
    alerts: [],
    ...over,
  }) as VisitRequestDetail;

describe("GuestInformationSection", () => {
  it("warns reception when the email belongs to someone else on record", () => {
    renderWithIntl(
      <GuestInformationSection
        data={visit({
          storedVisitor: { fullName: "Real Name", organization: null },
        })}
        hasAlert={false}
      />,
    );
    expect(screen.getByText("Someone Else")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "This email belongs to Real Name in our records",
    );
  });

  it("shows no warning when the details match the record", () => {
    renderWithIntl(<GuestInformationSection data={visit()} hasAlert={false} />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});
