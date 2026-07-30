// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { themeBootstrap } from "./theme-bootstrap";
import {
  THEME_BOOTSTRAP_CONFIG,
  THEME_COLORS,
  THEME_INIT_SCRIPT,
  themeToggleLabel,
} from "./theme-context";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("style");
});

afterEach(() => {
  localStorage.clear();
  for (const meta of document.head.querySelectorAll('meta[name="theme-color"]')) meta.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("theme bootstrap", () => {
  function executeThemeBootstrap() {
    themeBootstrap(THEME_BOOTSTRAP_CONFIG);
  }

  function finishThemeBootstrap() {
    document.dispatchEvent(new Event("DOMContentLoaded"));
  }

  it.each([
    { stored: undefined, expected: "dark", label: "missing theme" },
    { stored: "system", expected: "dark", label: "legacy system preference" },
    { stored: "auto", expected: "dark", label: "unrecognized theme" },
    { stored: "dark", expected: "dark", label: "stored dark theme" },
    { stored: "light", expected: "light", label: "stored light theme" },
  ] as const)("bootstraps $expected for a $label", ({ stored, expected }) => {
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

  it("labels a server-rendered toggle with the stored theme before hydration", () => {
    localStorage.setItem("@diffgazer/docs-theme", "light");
    const toggle = document.createElement("button");
    toggle.dataset.docsThemeToggle = "";
    document.body.append(toggle);

    executeThemeBootstrap();

    expect(toggle).toHaveAttribute("aria-label", themeToggleLabel("light"));
    expect(toggle).toHaveTextContent("light");
    finishThemeBootstrap();
    toggle.remove();
  });

  it("falls back to the default theme when theme storage throws", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });

    executeThemeBootstrap();

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    finishThemeBootstrap();
    getItem.mockRestore();
  });

  it("serializes into an inline script that applies the same stamp", () => {
    localStorage.setItem("@diffgazer/docs-theme", "dark");

    // biome-ignore lint/security/noGlobalEval: runs the serialized bootstrap verbatim to prove the inlined head script stays self-contained.
    window.eval(THEME_INIT_SCRIPT);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.head.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      THEME_COLORS.dark,
    );
    finishThemeBootstrap();
  });

  it("bails out without throwing when the browser has no MutationObserver", () => {
    localStorage.setItem("@diffgazer/docs-theme", "light");
    vi.stubGlobal("MutationObserver", () => {
      throw new TypeError("MutationObserver is not a constructor");
    });

    expect(executeThemeBootstrap).not.toThrow();

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });
});
