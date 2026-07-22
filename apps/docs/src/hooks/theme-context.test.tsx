// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_INIT_SCRIPT } from "./theme-context";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("THEME_INIT_SCRIPT", () => {
  function executeThemeBootstrap() {
    // biome-ignore lint/security/noGlobalEval: executes the app's static, user-input-free bootstrap verbatim to verify its pre-hydration DOM contract.
    window.eval(THEME_INIT_SCRIPT);
  }

  function finishThemeBootstrap() {
    document.dispatchEvent(new Event("DOMContentLoaded"));
  }

  it.each([
    { stored: undefined, expected: "dark", label: "missing preference" },
    { stored: "system", expected: "dark", label: "invalid preference" },
    { stored: "dark", expected: "dark", label: "dark preference" },
    { stored: "light", expected: "light", label: "light preference" },
  ])("bootstraps the exact theme for a $label", ({ stored, expected }) => {
    if (stored !== undefined) localStorage.setItem("@diffgazer/docs-theme", stored);

    executeThemeBootstrap();

    expect(document.documentElement).toHaveAttribute("data-theme", expected);
    finishThemeBootstrap();
  });

  it("falls back to dark when theme storage throws", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });

    executeThemeBootstrap();

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    finishThemeBootstrap();
    getItem.mockRestore();
  });
});
