import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { CommsOptInsScreen, WithdrawConsentDialog } from "./CommsOptInsScreen";

const mutate = vi.fn();
const grantMutate = vi.fn();
const exportMutate = vi.fn();
const optInsParams = vi.fn();
const perms = new Set<string>();
vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({ hasPermission: (p: string) => perms.has(p) }),
}));
vi.mock("@/data/consent/queries", () => ({
  useWithdrawConsent: () => ({ mutate, isPending: false }),
  useGrantConsent: () => ({ mutate: grantMutate, isPending: false }),
  useExportOptIns: () => ({
    mutate: exportMutate,
    isPending: false,
    isError: false,
  }),
  useOptIns: (params: unknown) => {
    optInsParams(params);
    return {
      isLoading: false,
      isError: false,
      data: {
        items: [
          {
            email: "ngozi.achebe@dangote.com",
            fullName: "Ngozi Achebe",
            organization: "Dangote Group",
            consent: true,
            answeredAt: new Date("2026-10-18T17:42:00Z"),
            sourceVisitId: null,
            sourceReferenceCode: null,
            sourceVisitDate: null,
          },
          {
            email: "yaw.boateng@gipc.gov.gh",
            fullName: "Yaw Boateng",
            organization: null,
            consent: false,
            answeredAt: new Date("2026-10-19T09:00:00Z"),
            sourceVisitId: null,
            sourceReferenceCode: null,
            sourceVisitDate: null,
          },
        ],
        page: 1,
        pageSize: 8,
        total: 1284,
        totalPages: 161,
      },
    };
  },
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
      "emeka.obi@accessbankplc.com will stop getting Afreximbank event updates.",
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
    mutate.mockReset();
    grantMutate.mockReset();
    optInsParams.mockReset();
    perms.add("consent:read");
  });

  // Desktop table and phone cards both render in jsdom; take the first.
  const box = (email: string) =>
    screen.getAllByRole("checkbox", { name: `Email consent for ${email}` })[0];

  it("shows the count, rows and each person's status; hides export and withdraw without permission", () => {
    renderWithIntl(<CommsOptInsScreen />);
    // No page title or subtitle: the Insights tab already names the view.
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByText("1,284")).toBeInTheDocument();
    expect(box("ngozi.achebe@dangote.com")).toHaveAttribute(
      "data-state",
      "checked",
    );
    expect(box("yaw.boateng@gipc.gov.gh")).toHaveAttribute(
      "data-state",
      "unchecked",
    );
    // Read-only: neither direction can be changed.
    expect(box("ngozi.achebe@dangote.com")).toBeDisabled();
    expect(box("yaw.boateng@gipc.gov.gh")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Export CSV/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Withdraw consent" }),
    ).toBeNull();
  });

  it("lists consented people by default and switches status with the pills", () => {
    renderWithIntl(<CommsOptInsScreen />);
    expect(optInsParams).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "in", page: 1 }),
    );
    fireEvent.click(screen.getByRole("radio", { name: "Not consented" }));
    expect(optInsParams).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "out", page: 1 }),
    );
  });

  it("offers export and withdraw to holders of consent:export / consent:manage", () => {
    perms.add("consent:export");
    perms.add("consent:manage");
    renderWithIntl(<CommsOptInsScreen />);
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    expect(exportMutate).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Withdraw consent" }),
    ).toBeInTheDocument();
  });

  it("removes consent from the checkbox after confirming (consent:manage)", async () => {
    perms.add("consent:manage");
    mutate.mockImplementation((_e, opts) => opts.onSuccess({ affected: true }));
    renderWithIntl(<CommsOptInsScreen />);
    fireEvent.click(box("ngozi.achebe@dangote.com"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Remove email consent?");
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove consent" }),
    );
    expect(mutate).toHaveBeenCalledWith(
      "ngozi.achebe@dangote.com",
      expect.any(Object),
    );
    expect(
      await screen.findByText(
        "Consent withdrawn for ngozi.achebe@dangote.com.",
      ),
    ).toBeInTheDocument();
    // Staff can opt out but not back in.
    expect(box("yaw.boateng@gipc.gov.gh")).toBeDisabled();
    expect(box("yaw.boateng@gipc.gov.gh").parentElement).toHaveAttribute(
      "title",
      "Only a System Admin can add someone back.",
    );
  });

  it("lets a System Admin add consent back after confirming (consent:grant)", async () => {
    perms.add("consent:manage");
    perms.add("consent:grant");
    grantMutate.mockImplementation((_e, opts) =>
      opts.onSuccess({ affected: true }),
    );
    renderWithIntl(<CommsOptInsScreen />);
    fireEvent.click(box("yaw.boateng@gipc.gov.gh"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Add email consent?");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Add consent" }),
    );
    expect(grantMutate).toHaveBeenCalledWith(
      "yaw.boateng@gipc.gov.gh",
      expect.any(Object),
    );
    expect(mutate).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        "yaw.boateng@gipc.gov.gh will get event updates again.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the dialog open with an error when the change fails", async () => {
    perms.add("consent:manage");
    mutate.mockImplementation((_e, opts) => opts.onError(new Error("x")));
    renderWithIntl(<CommsOptInsScreen />);
    fireEvent.click(box("ngozi.achebe@dangote.com"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove consent" }),
    );
    expect(
      within(dialog).getByText("Something went wrong. Please try again."),
    ).toBeInTheDocument();
  });
});
