import { THEME_TOKEN_KEYS } from "@diffgazer/core/theme";
import { afterEach, describe, expect, test, vi } from "vitest";
import { darkPalette, lightPalette } from "../../../theme/palettes";
import { paletteForTheme, TOKEN_GROUPS } from "./theme-preview";

describe("theme preview", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("paletteForTheme returns darkPalette for 'dark'", () => {
    expect(paletteForTheme("dark", lightPalette)).toBe(darkPalette);
  });

  test("paletteForTheme returns lightPalette for 'light'", () => {
    expect(paletteForTheme("light", darkPalette)).toBe(lightPalette);
  });

  test("paletteForTheme on 'auto' returns the terminal-detected palette", () => {
    vi.stubEnv("COLORFGBG", "0;15");

    const previewPalette = paletteForTheme("auto", darkPalette);

    expect(previewPalette).toBe(lightPalette);
    expect(previewPalette).not.toBe(darkPalette);
  });

  test("TOKEN_GROUPS covers every key in the cross-app vocabulary exactly once", () => {
    const flattened = TOKEN_GROUPS.flatMap((g) => g.keys);
    const unique = new Set(flattened);
    expect(flattened.length, "no key should appear in two groups").toBe(unique.size);
    expect(unique.size).toBe(THEME_TOKEN_KEYS.length);
    for (const key of THEME_TOKEN_KEYS) {
      expect(
        unique.has(key),
        `THEME_TOKEN_KEYS member '${key}' missing from grid groups`,
      ).toBeTruthy();
    }
  });

  test("TOKEN_GROUPS keeps the canonical primitive → semantic → severity → status order", () => {
    expect(TOKEN_GROUPS.map((g) => g.title)).toEqual([
      "Primitive",
      "Semantic",
      "Severity",
      "Status",
    ]);
  });
});
