import { screen, waitFor } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/data/http/client";
import { renderWithIntl } from "@/test/render";
import { GateLinkLanding } from "../[token]/GateLinkLanding";
import { GateKioskApp } from "./GateKioskApp";

const open = vi.fn();
vi.mock("@/data/gate/gate.api", () => ({
  gateApi: {
    open: (...args: unknown[]) => open(...args),
    verify: vi.fn(),
  },
}));
const replace = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/gate",
  Link: ({ children }: React.ComponentProps<"a">) => <a>{children}</a>,
}));
vi.mock("./GateKiosk", () => ({
  GateKiosk: ({ token }: { token: string }) => <p>scanner for {token}</p>,
}));

const TOKEN = "kiosk-token-0001";

beforeEach(() => {
  open.mockReset();
  replace.mockReset();
  window.localStorage.clear();
});

describe("GateKioskApp", () => {
  it("asks for the kiosk link on a device that was never set up", () => {
    renderWithIntl(<GateKioskApp token={null} />);
    expect(
      screen.getByRole("heading", {
        name: "This device isn't set up as the gate kiosk",
      }),
    ).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });

  it("shows only the language switcher, never account controls", () => {
    renderWithIntl(<GateKioskApp token={null} />);
    expect(screen.getByRole("button", { name: /language/i })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /switch account/i }),
    ).toBeNull();
    expect(screen.queryByText(/log out/i)).toBeNull();
  });

  it("runs the scanner for a live link", async () => {
    open.mockResolvedValue({ active: true });
    renderWithIntl(<GateKioskApp token={TOKEN} />);
    expect(await screen.findByText(`scanner for ${TOKEN}`)).toBeInTheDocument();
  });

  it("says a rotated or disabled link is no longer active", async () => {
    open.mockRejectedValue(new ApiError(404, "not active", {}));
    renderWithIntl(<GateKioskApp token={TOKEN} />);
    expect(
      await screen.findByRole("heading", {
        name: "This kiosk link is no longer active",
      }),
    ).toBeInTheDocument();
  });
});

describe("GateLinkLanding", () => {
  it("remembers a live link on the device and moves to plain /gate", async () => {
    open.mockResolvedValue({ active: true });
    renderWithIntl(<GateLinkLanding token={TOKEN} />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/gate"));
    expect(window.localStorage.getItem("vms.gateKioskToken")).toBe(TOKEN);
  });

  it("does not remember a dead link", async () => {
    open.mockRejectedValue(new ApiError(404, "not active", {}));
    renderWithIntl(<GateLinkLanding token={TOKEN} />);
    await screen.findByRole("heading", {
      name: "This kiosk link is no longer active",
    });
    expect(replace).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("vms.gateKioskToken")).toBeNull();
  });
});
