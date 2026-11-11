import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readTheme,
  resolveTheme,
  setTheme,
  subscribeTheme,
  themeScript,
  watchTheme,
} from "./theme";

let osDark = false;
let mediaListeners: Array<() => void> = [];

beforeEach(() => {
  osDark = false;
  mediaListeners = [];
  window.localStorage.clear();
  document.documentElement.dataset.theme = "light";
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      get matches() {
        return osDark;
      },
      addEventListener: (_: string, fn: () => void) => mediaListeners.push(fn),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("readTheme", () => {
  it("defaults to light when nothing is saved", () => {
    expect(readTheme()).toBe("light");
  });

  it("ignores an unknown saved value", () => {
    window.localStorage.setItem("vms.theme", "sepia");
    expect(readTheme()).toBe("light");
  });

  it("falls back to light when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    expect(readTheme()).toBe("light");
  });
});

describe("setTheme", () => {
  it("saves the choice, applies it to <html> and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);

    setTheme("dark");

    expect(window.localStorage.getItem("vms.theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("resolves system mode from the OS setting", () => {
    osDark = true;
    setTheme("system");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(resolveTheme("system")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
  });
});

describe("watchTheme", () => {
  it("follows an OS change while in system mode", () => {
    setTheme("system");
    const stop = watchTheme();

    osDark = true;
    mediaListeners.forEach((fn) => fn());

    expect(document.documentElement.dataset.theme).toBe("dark");
    stop();
  });

  it("picks up a change made in another tab", () => {
    const stop = watchTheme();
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);

    window.localStorage.setItem("vms.theme", "dark");
    window.dispatchEvent(new StorageEvent("storage", { key: "vms.theme" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    stop();
  });
});

describe("themeScript", () => {
  it("applies the saved theme before React loads", () => {
    window.localStorage.setItem("vms.theme", "dark");
    new Function(themeScript)();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("keeps light for a fresh device", () => {
    new Function(themeScript)();
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
