import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/data/http/client";
import { renderWithIntl } from "@/test/render";
import { SelfRegistrationScreen } from "./SelfRegistrationScreen";
import {
  blankSelfForm,
  problemOf,
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
  verify: vi.fn(),
};
vi.mock("@/data/desk-qr/desk-qr.api", () => ({
  publicRegistrationApi: {
    open: (...a: unknown[]) => api.open(...a),
    searchHosts: (...a: unknown[]) => api.searchHosts(...a),
    submit: (...a: unknown[]) => api.submit(...a),
    verify: (...a: unknown[]) => api.verify(...a),
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
    expect(problemOf(new ApiError(422, "x"))).toBe("codeWrong");
    expect(problemOf(new ApiError(423, "x"))).toBe("tooManyTries");
    expect(problemOf(new ApiError(429, "x"))).toBe("rateLimited");
    expect(problemOf(new TypeError("Failed to fetch"))).toBe("offline");
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

describe("SelfRegistrationScreen", () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    api.open.mockResolvedValue({ formToken: "ft", formExpiresAt: inTen() });
  });

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
  });

  it("sends the form, asks for the desk code and shows the reference", async () => {
    api.submit.mockResolvedValue({
      registrationId: "r1",
      codeExpiresAt: inTen(),
    });
    api.verify
      .mockRejectedValueOnce(new ApiError(422, "Wrong"))
      .mockResolvedValueOnce({
        referenceCode: "7C42-318",
        fullName: "Ifeoma Chukwu",
        hostName: null,
        visitDate: new Date().toISOString(),
      });
    renderWithIntl(<SelfRegistrationScreen token="tok" />);
    await fillAndSubmit();

    expect(
      await screen.findByText("Ask reception for your code"),
    ).toBeInTheDocument();
    expect(api.submit.mock.calls[0][1]).toMatchObject({
      formToken: "ft",
      email: "ifeoma@gtbank.com",
      needsEvacuationAssist: false,
      commsConsent: true,
    });

    const codeInput = screen.getByLabelText("6-digit code");
    fireEvent.change(codeInput, { target: { value: "12a3456" } });
    expect(codeInput).toHaveValue("123456");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("2 tries left");

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("You're registered")).toBeInTheDocument();
    expect(screen.getByText("7C42-318")).toBeInTheDocument();
  });

  it("sends people back to the start after too many wrong codes", async () => {
    api.submit.mockResolvedValue({
      registrationId: "r1",
      codeExpiresAt: inTen(),
    });
    api.verify.mockRejectedValue(new ApiError(423, "Locked"));
    renderWithIntl(<SelfRegistrationScreen token="tok" />);
    await fillAndSubmit();
    fireEvent.change(await screen.findByLabelText("6-digit code"), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("Too many wrong codes")).toBeInTheDocument();
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
});
