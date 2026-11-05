import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { CardPreviewDialog } from "./CardPreviewDialog";

const card = {
  fullName: "Ifeoma Chukwu",
  organization: "Guaranty Trust Bank",
  cardNumber: "RF-0042",
  validFrom: "2026-10-24T07:00:00.000Z",
  validUntil: "2026-10-26T17:00:00.000Z",
  photoUrl: null,
};

describe("CardPreviewDialog", () => {
  it("opens on the front and flips to the back and back again", () => {
    renderWithIntl(
      <CardPreviewDialog open onOpenChange={vi.fn()} card={card} />,
    );
    expect(
      screen.getByRole("img", { name: /Card front for Ifeoma/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Card back" })).toBeNull();
    expect(screen.getByText("Front")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Flip card" }));
    expect(screen.getByRole("img", { name: "Card back" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Card front for/ })).toBeNull();
    expect(screen.getByText("Back")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Flip card" }));
    expect(
      screen.getByRole("img", { name: /Card front for Ifeoma/ }),
    ).toBeInTheDocument();
  });

  it("offers Print only when the card can be printed", () => {
    const { unmount } = renderWithIntl(
      <CardPreviewDialog open onOpenChange={vi.fn()} card={card} />,
    );
    expect(screen.queryByRole("button", { name: /Print/ })).toBeNull();
    unmount();

    renderWithIntl(
      <CardPreviewDialog
        open
        onOpenChange={vi.fn()}
        card={card}
        onPrinted={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Print card" }),
    ).toBeInTheDocument();
  });
});
