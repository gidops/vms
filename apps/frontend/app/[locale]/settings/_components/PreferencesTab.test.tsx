import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { PreferencesTab } from "./PreferencesTab";

vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({ user: null, refreshUser: vi.fn() }),
}));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => ({ replace: vi.fn() }),
}));

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.dataset.theme = "light";
});

describe("PreferencesTab — Appearance", () => {
  it("starts on Light and switches the app to Dark", () => {
    renderWithIntl(<PreferencesTab />);
    const group = screen.getByRole("radiogroup", { name: "Appearance" });
    const light = screen.getByRole("radio", { name: "Light" });
    const dark = screen.getByRole("radio", { name: "Dark" });

    expect(group).toBeInTheDocument();
    expect(light).toHaveAttribute("aria-checked", "true");

    fireEvent.click(dark);

    expect(dark).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("vms.theme")).toBe("dark");
  });
});
