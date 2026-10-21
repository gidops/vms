import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { CommsOptInsScreen, WithdrawConsentDialog } from "./CommsOptInsScreen";

const mutate = vi.fn();
const exportMutate = vi.fn();
const perms = new Set<string>();
vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: (p: string) => perms.has(p) }),
}));
vi.mock("./VisitDetailSheet", () => ({ VisitDetailSheet: () => null }));
vi.mock("@/data/consent/queries", () => ({
  useWithdrawConsent: () => ({ mutate, isPending: false }),
  useExportOptIns: () => ({
    mutate: exportMutate,
    isPending: false,
    isError: false,
  }),
  useOptIns: () => ({
    isLoading: false,
    isError: false,
    data: {
      items: [
        {
          email: "ngozi.achebe@dangote.com",
          fullName: "Ngozi Achebe",
          organization: "Dangote Group",
          consentedAt: new Date("2026-10-18T17:42:00Z"),
          sourceVisitId: "00000000-0000-4000-8000-000000000031",
          sourceReferenceCode: "VST-20481",
          sourceVisitDate: null,
        },
      ],
      page: 1,
      pageSize: 8,
      total: 1284,
      totalPages: 161,
    },
  }),
}));

describe("WithdrawConsentDialog", () => {
  beforeEach(() => {
    // Block body: a returned mock would be run by vitest as a cleanup hook.
    mutate.mockReset();
  });

  async function openDialog(onWithdrawn = vi.fn()) {
    renderWithIntl(<WithdrawConsentDialog onWithdrawn={onWithdrawn} />);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw consent" }));
    return screen.findByRole("dialog");
  }

  it("validates the email before asking", async () => {
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Withdraw" }));
    expect(
      within(dialog).getByText("Enter a valid email address."),
    ).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("only withdraws after confirming the warning", async () => {
    const onWithdrawn = vi.fn();
    mutate.mockImplementation((_e, opts) => opts.onSuccess({ affected: true }));
    const dialog = await openDialog(onWithdrawn);
    fireEvent.change(within(dialog).getByLabelText("Email"), {
      target: { value: "emeka.obi@accessbankplc.com" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Withdraw" }));
    expect(dialog).toHaveTextContent("Withdraw consent?");
    expect(dialog).toHaveTextContent(
      "emeka.obi@accessbankplc.com leaves the opt-in list now. Past visit records stay as they are.",
    );
    expect(mutate).not.toHaveBeenCalled();

    // Cancel backs out of the confirmation without withdrawing.
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(dialog).not.toHaveTextContent("Withdraw consent?");
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Withdraw" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Withdraw" }));
    expect(mutate).toHaveBeenCalledWith(
      "emeka.obi@accessbankplc.com",
      expect.any(Object),
    );
    expect(onWithdrawn).toHaveBeenCalledWith("emeka.obi@accessbankplc.com");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("says when an email has no records", async () => {
    mutate.mockImplementation((_e, opts) =>
      opts.onSuccess({ affected: false }),
    );
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByLabelText("Email"), {
      target: { value: "nobody@x.com" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Withdraw" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Withdraw" }));
    expect(
      await within(dialog).findByText("No records for this email."),
    ).toBeInTheDocument();
  });
});

describe("CommsOptInsScreen", () => {
  beforeEach(() => {
    perms.clear();
  });

  it("shows the count and rows; hides export and withdraw without permission", () => {
    perms.add("consent:read");
    renderWithIntl(<CommsOptInsScreen />);
    expect(screen.getByText("1,284")).toBeInTheDocument();
    expect(
      screen.getAllByText("ngozi.achebe@dangote.com").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("VST-20481").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Export CSV/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Withdraw consent" }),
    ).toBeNull();
  });

  it("offers export and withdraw to holders of consent:export / consent:manage", () => {
    perms.add("consent:read");
    perms.add("consent:export");
    perms.add("consent:manage");
    renderWithIntl(<CommsOptInsScreen />);
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    expect(exportMutate).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Withdraw consent" }),
    ).toBeInTheDocument();
  });
});
