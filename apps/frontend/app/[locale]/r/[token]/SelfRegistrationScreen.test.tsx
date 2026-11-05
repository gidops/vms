import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/data/http/client";
import { renderWithIntl } from "@/test/render";
import { SelfRegistrationScreen } from "./SelfRegistrationScreen";
import {
  blankSelfForm,
  deadlineOf,
  phaseOf,
  problemOf,
  secondsUntil,
  selfFormErrors,
  toRegistrationInput,
  type SelfForm,
} from "./self-registration";

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/r/tok",
  useRouter: () => ({ replace: vi.fn() }),
}));
const api = {
  open: vi.fn(),
  searchHosts: vi.fn(),
  submit: vi.fn(),
};
vi.mock("@/data/desk-qr/desk-qr.api", () => ({
  publicRegistrationApi: {
    open: (...a: unknown[]) => api.open(...a),
    searchHosts: (...a: unknown[]) => api.searchHosts(...a),
    submit: (...a: unknown[]) => api.submit(...a),
  },
}));

const filled = (over: Partial<SelfForm> = {}): SelfForm => ({
  ...blankSelfForm(),
  email: "ifeoma@gtbank.com",
  fullName: "Ifeoma Chukwu",
  organization: "Guaranty Trust Bank",
  purpose: "Official",
  needsEvacuationAssist: false,
  commsConsent: true,
  ...over,
});

describe("self-registration form rules", () => {
  it("needs email, name, organisation, purpose and both answers", () => {
    expect(Object.keys(selfFormErrors(blankSelfForm())).sort()).toEqual(
      [
        "commsConsent",
        "email",
        "fullName",
        "needsEvacuationAssist",
        "organization",
        "purpose",
      ].sort(),
    );
    expect(selfFormErrors(filled())).toEqual({});
  });

  it("rejects links and markup in the name and organisation", () => {
    expect(
      selfFormErrors(
        filled({ fullName: "Visit www.evil.com", organization: "acme.com" }),
      ),
    ).toEqual({ fullName: "plainName", organization: "plainOrganization" });
  });

  it("keeps the phone optional but checks it when given", () => {
    expect(selfFormErrors(filled({ phoneNumber: "12" }))).toHaveProperty(
      "phone",
    );
    expect(selfFormErrors(filled({ phoneNumber: "8035521904" }))).toEqual({});
  });

  it("asks what help is needed after a Yes", () => {
    expect(
      selfFormErrors(filled({ needsEvacuationAssist: true })),
    ).toHaveProperty("evacuationAssistTypes", "chooseType");
    expect(
      selfFormErrors(
        filled({
          needsEvacuationAssist: true,
          evacuationAssistTypes: ["OTHER"],
        }),
      ),
    ).toHaveProperty("evacuationAssistOther", "describeOther");
  });

  it("builds the request with E.164 phone and no help types on a No", () => {
    const input = toRegistrationInput(
      filled({ phoneNumber: "803 552 1904", website: "" }),
      "form-token",
    );
    expect(input).toMatchObject({
      formToken: "form-token",
      phone: "+2348035521904",
      needsEvacuationAssist: false,
      commsConsent: true,
    });
    expect(input).not.toHaveProperty("evacuationAssistTypes");
    expect(input.website).toBeUndefined();
  });

  it("maps API answers to what the visitor sees", () => {
    expect(problemOf(new ApiError(404, "x"))).toBe("inactive");
    expect(problemOf(new ApiError(410, "x"))).toBe("expired");
    expect(problemOf(new ApiError(422, "x"))).toBe("rejected");
    expect(problemOf(new ApiError(429, "x"))).toBe("rateLimited");
    expect(problemOf(new TypeError("Failed to fetch"))).toBe("offline");
  });
});

describe("phaseOf", () => {
  const data = {
    formToken: "ft",
    formExpiresAt: new Date(),
    secondsLeft: 600,
    receivedAt: 0,
  };
  const open = { loading: false, problem: null, data };

  it("waits while the form opens, whatever the step", () => {
    expect(phaseOf({ ...open, loading: true }, { kind: "expired" })).toEqual({
      kind: "opening",
    });
  });

  it("puts a failed open ahead of the step", () => {
    expect(phaseOf({ ...open, problem: "inactive" }, { kind: "form" })).toEqual(
      { kind: "inactive" },
    );
    expect(phaseOf({ ...open, problem: "offline" }, { kind: "form" })).toEqual({
      kind: "expired",
    });
  });

  it("shows the form with its session, or the later step", () => {
    expect(phaseOf(open, { kind: "form" })).toEqual({
      kind: "form",
      session: data,
    });
    expect(phaseOf({ ...open, data: undefined }, { kind: "form" })).toEqual({
      kind: "opening",
    });
    expect(phaseOf(open, { kind: "expired" })).toEqual({ kind: "expired" });
  });

  it("counts down from the server's seconds, not the expiry timestamp", () => {
    const deadline = deadlineOf({ receivedAt: 1_000, secondsLeft: 90 });
    expect(secondsUntil(deadline, 1_000)).toBe(90);
    expect(secondsUntil(deadline, 31_500)).toBe(60);
    expect(secondsUntil(deadline, 999_999)).toBe(0);
  });
});

const inTen = () => new Date(Date.now() + 10 * 60_000).toISOString();

async function fillAndSubmit() {
  fireEvent.change(await screen.findByLabelText(/Email address/), {
    target: { value: "ifeoma@gtbank.com" },
  });
  fireEvent.change(screen.getByLabelText(/Full name/), {
    target: { value: "Ifeoma Chukwu" },
  });
  fireEvent.change(screen.getByLabelText(/Organisation/), {
    target: { value: "Guaranty Trust Bank" },
  });
  // Purpose is a Radix select: open it and pick an option.
  fireEvent.click(screen.getByLabelText(/Purpose of visit/));
  fireEvent.click(await screen.findByRole("option", { name: "Official" }));
  const [evac, consent] = screen.getAllByRole("radiogroup");
  fireEvent.click(within(evac).getAllByRole("radio")[1]); // No
  fireEvent.click(within(consent).getAllByRole("radio")[0]); // Yes
  fireEvent.click(screen.getByRole("button", { name: "Register my visit" }));
}

// Each case walks the whole multi-step form, which can exceed 5s on a busy CI runner.
describe("SelfRegistrationScreen", { timeout: 15_000 }, () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    api.open.mockResolvedValue({
      formToken: "ft",
      formExpiresAt: inTen(),
      secondsLeft: 600,
    });
  });
  afterEach(() => vi.useRealTimers());

  it("opens the form with today's date and the 10-minute timer", async () => {
    renderWithIntl(<SelfRegistrationScreen token="tok" />);
    expect(
      await screen.findByRole("heading", { name: "Register your visit" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Form expires in (9:5\d|10:00)/),
    ).toBeInTheDocument();
    expect(api.open).toHaveBeenCalledWith("tok");
  });

  it("says the code isn't active for a replaced or disabled QR", async () => {
    api.open.mockRejectedValue(new ApiError(404, "Not active"));
    renderWithIntl(<SelfRegistrationScreen token="tok" />);
    expect(
      await screen.findByText("This QR code isn't active"),
    ).toBeInTheDocument();
  });

  it("counts what is missing instead of sending", async () => {
    renderWithIntl(<SelfRegistrationScreen token="tok" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Register my visit" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Check 6 answers below.",
    );
    expect(api.submit).not.toHaveBeenCalled();
    // The count follows the visitor's fixes.
    fireEvent.change(screen.getByLabelText(/Full name/), {
      target: { value: "Ifeoma Chukwu" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Check 5 answers below.",
    );
  });

  it("sends the form and confirms the registration straight away", async () => {
    api.submit.mockResolvedValue({
      fullName: "Ifeoma Chukwu",
      hostName: null,
      visitDate: new Date().toISOString(),
    });
    renderWithIntl(<SelfRegistrationScreen token="tok" />);
    await fillAndSubmit();

    expect(await screen.findByText("You're registered")).toBeInTheDocument();
    expect(
      screen.getByText(/Reception will hand you your visitor pass/),
    ).toBeInTheDocument();
    expect(api.submit.mock.calls[0][1]).toMatchObject({
      formToken: "ft",
      email: "ifeoma@gtbank.com",
      needsEvacuationAssist: false,
      commsConsent: true,
    });
  });

  it("sends people back to the start when the form token is rejected", async () => {
    api.submit.mockRejectedValue(new ApiError(422, "Rejected"));
    renderWithIntl(<SelfRegistrationScreen token="tok" />);
    await fillAndSubmit();
    expect(
      await screen.findByText("This form has expired"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start again" }));
    await waitFor(() => expect(api.open).toHaveBeenCalledTimes(2));
  });

  it("keeps the answers and explains when the phone is offline", async () => {
    api.submit.mockRejectedValue(new TypeError("Failed to fetch"));
    renderWithIntl(<SelfRegistrationScreen token="tok" />);
    await fillAndSubmit();
    expect(await screen.findByRole("alert")).toHaveTextContent("No connection");
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Ifeoma Chukwu");
  });

  it("times the form from secondsLeft, not the phone's clock", async () => {
    // A phone set years ahead, and an expiry stamp that disagrees with it.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2040-01-01T09:00:00Z"));
    api.open.mockResolvedValue({
      formToken: "ft",
      formExpiresAt: "2001-01-01T00:00:00.000Z",
      secondsLeft: 125,
    });
    renderWithIntl(<SelfRegistrationScreen token="tok" />);
    expect(
      await screen.findByText(/Form expires in 2:0[45]/),
    ).toBeInTheDocument();
  });

  it("announces the last minute and focuses the notice when time runs out", async () => {
    api.open.mockResolvedValue({
      formToken: "ft",
      formExpiresAt: inTen(),
      secondsLeft: 2,
    });
    renderWithIntl(<SelfRegistrationScreen token="tok" />);
    expect(await screen.findByText("1 minute left")).toHaveAttribute(
      "aria-live",
      "polite",
    );
    const heading = await screen.findByRole(
      "heading",
      { name: "This form has expired" },
      { timeout: 4_000 },
    );
    expect(heading).toHaveFocus();
  });

  it("links each field error to its control", async () => {
    renderWithIntl(<SelfRegistrationScreen token="tok" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Register my visit" }),
    );
    const name = screen.getByLabelText(/Full name/);
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Fill this in");
    expect(
      screen.getByRole("radiogroup", { name: /emergency/ }),
    ).toHaveAccessibleDescription("Choose Yes or No");
  });

  it("labels the host search and announces the results", async () => {
    api.searchHosts.mockResolvedValue([]);
    renderWithIntl(<SelfRegistrationScreen token="tok" />);
    const search = await screen.findByLabelText(
      "Search for the person you're visiting",
    );
    fireEvent.change(search, { target: { value: "Ade" } });
    await waitFor(() =>
      expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain(
        "No matching staff. Leave blank for a general enquiry.",
      ),
    );
    expect(api.searchHosts).toHaveBeenCalledWith("tok", "Ade", "ft");
  });
});
