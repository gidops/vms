import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { PERMISSIONS, type DeskQrView } from "@vms/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { DeskQrScreen } from "./DeskQrScreen";

const perms = new Set<string>();
vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: (p: string) => perms.has(p) }),
}));

type Query = {
  isLoading: boolean;
  isError: boolean;
  data?: DeskQrView | null;
  refetch: () => void;
};
let deskQr: Query;
const actions = {
  create: vi.fn(),
  rotate: vi.fn(),
  disable: vi.fn(),
  enable: vi.fn(),
};
const mutation = (fn: (...a: unknown[]) => void) => ({
  mutate: (arg: unknown, opts?: { onSuccess?: () => void }) => {
    fn(arg);
    opts?.onSuccess?.();
  },
  isPending: false,
  isError: false,
  error: null,
});
vi.mock("@/data/desk-qr/desk-qr.api", () => ({
  deskQrApi: {
    create: () => actions.create(),
    rotate: () => actions.rotate(),
    disable: () => actions.disable(),
    enable: () => actions.enable(),
  },
}));
vi.mock("@/data/desk-qr/queries", () => ({
  useDeskQr: () => deskQr,
  useDeskQrImage: () => ({
    data: "blob:qr",
    blob: new Blob(["png"]),
    isError: false,
  }),
  useDownloadDeskQr: () => mutation(vi.fn()),
  useCreateDeskQr: () => mutation(() => void actions.create()),
  useRotateDeskQr: () => mutation(() => void actions.rotate()),
  useDisableDeskQr: () => mutation(() => void actions.disable()),
  useEnableDeskQr: () => mutation(() => void actions.enable()),
}));

const view = (over: Partial<DeskQrView> = {}): DeskQrView => ({
  id: "qr1",
  isActive: true,
  url: "https://vms.example.org/r/k7Qm2xVb9TfLw4Rz8cPd00",
  scansToday: 37,
  lastScanAt: new Date("2026-10-19T09:42:00Z"),
  tokenRotatedAt: new Date("2026-10-02T08:15:00Z"),
  disabledAt: null,
  createdAt: new Date("2026-10-02T08:15:00Z"),
  createdByName: "Judith Francis",
  ...over,
});

describe("DeskQrScreen", () => {
  beforeEach(() => {
    perms.clear();
    perms.add(PERMISSIONS.ISSUER_READ);
    perms.add(PERMISSIONS.ISSUER_MANAGE);
    Object.values(actions).forEach((a) => a.mockReset());
    deskQr = {
      isLoading: false,
      isError: false,
      data: view(),
      refetch: vi.fn(),
    };
  });

  it("shows the QR, its link and today's scans", () => {
    renderWithIntl(<DeskQrScreen />);
    const card = screen.getByRole("region", { name: /Walk-in QR/ });
    expect(within(card).getByText("Active")).toBeInTheDocument();
    expect(within(card).getByAltText("Walk-in QR code")).toHaveAttribute(
      "src",
      "blob:qr",
    );
    expect(
      within(card).getByText(/k7Qm2xVb9TfLw4Rz8cPd00/),
    ).toBeInTheDocument();
    expect(within(card).getByText("37")).toBeInTheDocument();
    expect(within(card).getByText("Last scan 10:42 WAT")).toBeInTheDocument();
    for (const name of ["New QR", "Disable"])
      expect(
        within(card).getByRole("button", { name: new RegExp(name) }),
      ).toBeInTheDocument();
    // Print / Download sit in the page header row (staff/VMC pattern).
    for (const name of ["Print poster", "Download PNG"])
      expect(
        screen.getByRole("button", { name: new RegExp(name) }),
      ).toBeInTheDocument();
  });

  it("drops its title under the Operations tab but keeps the header actions", () => {
    renderWithIntl(<DeskQrScreen headingLevel={2} showHeading={false} />);
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    for (const name of ["Print poster", "Download PNG"])
      expect(
        screen.getByRole("button", { name: new RegExp(name) }),
      ).toBeInTheDocument();
  });

  it("asks before New QR and only rotates on confirm", async () => {
    renderWithIntl(<DeskQrScreen />);
    fireEvent.click(screen.getByRole("button", { name: /New QR/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Replace the walk-in QR?");
    expect(dialog).toHaveTextContent("stops working immediately");
    expect(actions.rotate).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create new QR" }),
    );
    expect(actions.rotate).toHaveBeenCalledTimes(1);
  });

  it("asks before Disable", async () => {
    renderWithIntl(<DeskQrScreen />);
    fireEvent.click(screen.getByRole("button", { name: /Disable/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(actions.disable).not.toHaveBeenCalled();
  });

  it("offers Enable when disabled and greys the QR", () => {
    deskQr.data = view({
      isActive: false,
      disabledAt: new Date("2026-10-19T07:02:00Z"),
    });
    renderWithIntl(<DeskQrScreen />);
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(
      screen.getAllByText(/Please register at the VMC desk/).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /^Disable$/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    expect(actions.enable).toHaveBeenCalled();
  });

  it("shows no management buttons to read-only roles", () => {
    perms.delete(PERMISSIONS.ISSUER_MANAGE);
    renderWithIntl(<DeskQrScreen />);
    expect(screen.queryByRole("button", { name: /New QR/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Disable/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Print poster/ }),
    ).toBeInTheDocument();
  });

  it("creates the desk QR from the empty state", () => {
    deskQr.data = null;
    renderWithIntl(<DeskQrScreen />);
    expect(screen.getByText("No walk-in QR yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create walk-in QR" }));
    expect(actions.create).toHaveBeenCalledTimes(1);
  });

  it("tells read-only roles reception hasn't set it up", () => {
    perms.delete(PERMISSIONS.ISSUER_MANAGE);
    deskQr.data = null;
    renderWithIntl(<DeskQrScreen />);
    expect(
      screen.getByText("Reception hasn't set up the walk-in QR yet."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create walk-in QR" }),
    ).toBeNull();
  });

  it("shows a spinner while loading and a retry on error", () => {
    deskQr = { isLoading: true, isError: false, refetch: vi.fn() };
    const { unmount } = renderWithIntl(<DeskQrScreen />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    unmount();
    const refetch = vi.fn();
    deskQr = { isLoading: false, isError: true, refetch };
    renderWithIntl(<DeskQrScreen />);
    expect(
      screen.getByText("Couldn't load the walk-in QR."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(refetch).toHaveBeenCalled();
  });
});
