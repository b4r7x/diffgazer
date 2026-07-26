// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { stubMatchMedia } from "@diffgazer/core/testing/match-media";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_COLORS, THEME_INIT_SCRIPT, themeToggleLabel } from "./theme-context";

function stubSystemTheme(theme: "dark" | "light") {
  stubMatchMedia((query) => query.includes("prefers-color-scheme: dark") && theme === "dark");
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("style");
  stubSystemTheme("light");
});

afterEach(() => {
  localStorage.clear();
  for (const meta of document.head.querySelectorAll('meta[name="theme-color"]')) meta.remove();
  stubMatchMedia(false);
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
    { stored: undefined, system: "dark", expected: "dark", label: "missing preference" },
    { stored: undefined, system: "light", expected: "light", label: "missing preference" },
    { stored: "auto", system: "dark", expected: "dark", label: "invalid preference" },
    { stored: "system", system: "light", expected: "light", label: "system preference" },
    { stored: "system", system: "dark", expected: "dark", label: "system preference" },
    { stored: "dark", system: "light", expected: "dark", label: "pinned dark preference" },
    { stored: "light", system: "dark", expected: "light", label: "pinned light preference" },
  ] as const)("bootstraps $expected for a $label under a $system system theme", ({
    stored,
    system,
    expected,
  }) => {
    stubSystemTheme(system);
    if (stored !== undefined) localStorage.setItem("@diffgazer/docs-theme", stored);

    executeThemeBootstrap();

    expect(document.documentElement).toHaveAttribute("data-theme", expected);
    expect(document.documentElement.style.colorScheme).toBe(expected);
    finishThemeBootstrap();
  });

  it("adds one browser chrome color meta for the bootstrapped theme", () => {
    localStorage.setItem("@diffgazer/docs-theme", "light");

    executeThemeBootstrap();

    const metas = document.head.querySelectorAll('meta[name="theme-color"]');
    expect(metas).toHaveLength(1);
    expect(metas[0]).toHaveAttribute("content", THEME_COLORS.light);
    finishThemeBootstrap();
  });

  it("labels a server-rendered toggle with the stored preference before hydration", () => {
    localStorage.setItem("@diffgazer/docs-theme", "system");
    const toggle = document.createElement("button");
    toggle.dataset.docsThemeToggle = "";
    document.body.append(toggle);

    executeThemeBootstrap();

    expect(toggle).toHaveAttribute("aria-label", themeToggleLabel("system"));
    expect(toggle).toHaveTextContent("system");
    finishThemeBootstrap();
    toggle.remove();
  });

  it("falls back to the system theme when theme storage throws", () => {
    stubSystemTheme("dark");
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });

    executeThemeBootstrap();

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    finishThemeBootstrap();
    getItem.mockRestore();
  });

  it("bails out without throwing when the browser has no matchMedia", () => {
    // The script runs in <head> before the first paint, so a stripped webview
    // must get a silent bail-out that leaves the served theme alone rather than
    // an uncaught error on every load.
    document.documentElement.setAttribute("data-theme", "dark");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: () => {
        throw new TypeError("matchMedia is not a function");
      },
    });

    expect(executeThemeBootstrap).not.toThrow();

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.head.querySelectorAll('meta[name="theme-color"]')).toHaveLength(0);
  });
});
