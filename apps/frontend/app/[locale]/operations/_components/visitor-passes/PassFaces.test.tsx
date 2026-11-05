import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/render";
import { PassBack, PassFront, venueLines } from "./PassFaces";

describe("visitor pass faces", () => {
  it("prints the venue on two lines and the 3-digit pass ID", () => {
    renderWithIntl(
      <PassFront pass={{ zone: "5th Floor - Left Wing", cardNumber: "007" }} />,
    );
    const front = screen.getByRole("img", {
      name: "Visitor pass front: 5th Floor - Left Wing, pass 007",
    });
    expect(front).toHaveAttribute("dir", "ltr");
    expect(front).toHaveTextContent("VISITOR PASS");
    expect(front).toHaveTextContent("Pass ID: 007");
    expect(front).toHaveTextContent(
      "Must be visibly worn at all times while on premises",
    );
    expect(
      screen.getByTestId("pass-venue").querySelectorAll("br"),
    ).toHaveLength(1);
    expect(screen.getByTestId("pass-venue")).toHaveTextContent(
      "5th FloorLeft Wing",
    );
  });

  it("splits venues like v1 and falls back to N/A", () => {
    expect(venueLines("3rd Floor - Right Wing")).toEqual([
      "3rd Floor",
      "Right Wing",
    ]);
    expect(venueLines("Ground Floor")).toEqual(["Ground Floor"]);
    expect(venueLines("")).toEqual(["N/A"]);
  });

  it("uses the approved back artwork", () => {
    renderWithIntl(<PassBack />);
    const back = screen.getByRole("img", { name: "Visitor pass back" });
    expect(back.querySelector("img")).toHaveAttribute(
      "src",
      "/brand/visitor-pass/back.jpg",
    );
  });
});
