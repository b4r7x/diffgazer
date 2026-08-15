import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stubMatchMedia } from "@diffgazer/core/testing/match-media";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyResolvedTheme, THEME_COLORS, THEME_STORAGE_KEY } from "@/theme-bootstrap";

const indexHtml = readFileSync(resolve(import.meta.dirname, "../index.html"), "utf8");

/**
 * The shipped pre-paint script, run as the browser would run it. Testing the
 * real inline source is what keeps it honest against `theme-bootstrap.ts`.
 */
function runInlineThemeBootstrap(): void {
  const shell = new DOMParser().parseFromString(indexHtml, "text/html");
  const inlineScript = shell.querySelector("head > script:not([src])")?.textContent;
  if (!inlineScript) throw new Error("index.html has no inline theme bootstrap script");
  new Function(inlineScript)();
}

function storedTheme(theme: string): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

describe("pre-paint theme bootstrap", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
    const themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    themeColor.content = THEME_COLORS.dark;
    document.head.append(themeColor);
  });

  afterEach(() => {
    document.querySelector('meta[name="theme-color"]')?.remove();
    vi.restoreAllMocks();
  });

  it("paints the stored light theme before the app mounts", () => {
    stubMatchMedia(() => true);
    storedTheme("light");

    runInlineThemeBootstrap();

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      THEME_COLORS.light,
    );
  });

  it("resolves a stored auto theme against the OS preference", () => {
    stubMatchMedia((query) => query === "(prefers-color-scheme: dark)");
    storedTheme("auto");

    runInlineThemeBootstrap();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      THEME_COLORS.dark,
    );
  });

  it("falls back to the OS preference when nothing is stored", () => {
    stubMatchMedia(() => false);

    runInlineThemeBootstrap();

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("falls back to the OS preference when storage reads are denied", () => {
    stubMatchMedia((query) => query === "(prefers-color-scheme: dark)");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("access denied");
    });

    runInlineThemeBootstrap();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      THEME_COLORS.dark,
    );
  });

  it("re-themes the document the same way once settings resolve", () => {
    applyResolvedTheme("light");

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      THEME_COLORS.light,
    );
  });

  it("serves no hardcoded theme so the bootstrap owns the first paint", () => {
    const shell = new DOMParser().parseFromString(indexHtml, "text/html");

    expect(shell.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(indexHtml).toContain(THEME_STORAGE_KEY);
  });

  it("declares the CSP nonce placeholder consumed by the embedded server", () => {
    expect(indexHtml).toContain('nonce="{{cspNonce}}"');
    const shell = new DOMParser().parseFromString(indexHtml, "text/html");
    const inlineScript = shell.querySelector("head > script:not([src])");

    expect(inlineScript?.getAttribute("nonce")).toBe("{{cspNonce}}");
  });
});
