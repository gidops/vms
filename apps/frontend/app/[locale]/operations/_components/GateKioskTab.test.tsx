import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GateKiosk } from "@/data/gate/gate.api";
import { renderWithIntl } from "@/test/render";
import { GateKioskTab } from "./GateKioskTab";

const api = {
  get: vi.fn(),
  create: vi.fn(),
  rotate: vi.fn(),
  disable: vi.fn(),
  enable: vi.fn(),
  image: vi.fn(),
};
vi.mock("@/data/gate/gate.api", () => ({
  gateKioskApi: {
    get: () => api.get(),
    create: () => api.create(),
    rotate: () => api.rotate(),
    disable: () => api.disable(),
    enable: () => api.enable(),
    image: () => api.image(),
  },
}));

const view = (over: Partial<GateKiosk> = {}): GateKiosk => ({
  id: "k1",
  isActive: true,
  url: "https://vms.example/gate/tok_tok_tok_tok_1",
  tokenRotatedAt: "2026-10-28T08:00:00.000Z",
  disabledAt: null,
  lastScanAt: null,
  createdAt: "2026-10-28T08:00:00.000Z",
  createdByName: "System Admin",
  ...over,
});

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  api.image.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
  URL.createObjectURL = vi.fn(() => "blob:qr");
  URL.revokeObjectURL = vi.fn();
});

describe("GateKioskTab", () => {
  it("creates the kiosk link from the empty state", async () => {
    api.get.mockResolvedValue(null);
    api.create.mockResolvedValue(view());
    renderWithIntl(<GateKioskTab />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Create kiosk link" }),
    );
    expect(
      await screen.findByText("https://vms.example/gate/tok_tok_tok_tok_1"),
    ).toBeInTheDocument();
    expect(api.create).toHaveBeenCalled();
  });

  it("confirms before replacing the link", async () => {
    api.get.mockResolvedValue(view());
    api.rotate.mockResolvedValue(
      view({ url: "https://vms.example/gate/new_new_new_new_1" }),
    );
    renderWithIntl(<GateKioskTab />);

    fireEvent.click(await screen.findByRole("button", { name: "New link" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create new link" }),
    );
    await waitFor(() => expect(api.rotate).toHaveBeenCalled());
    expect(
      await screen.findByText("https://vms.example/gate/new_new_new_new_1"),
    ).toBeInTheDocument();
  });

  it("offers Turn on for a turned-off link", async () => {
    api.get.mockResolvedValue(
      view({ isActive: false, disabledAt: "2026-10-28T09:00:00.000Z" }),
    );
    api.enable.mockResolvedValue(view());
    renderWithIntl(<GateKioskTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Turn on" }));
    await waitFor(() => expect(api.enable).toHaveBeenCalled());
    expect(
      screen.queryByRole("button", { name: "Turn off" }),
    ).toBeInTheDocument();
  });
});
