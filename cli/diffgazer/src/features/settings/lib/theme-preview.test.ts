import { THEME_TOKEN_KEYS } from "@diffgazer/core/theme";
import { describe, expect, test } from "vitest";
import { darkPalette, lightPalette } from "../../../theme/palettes";
import { paletteForTheme, TOKEN_GROUPS } from "./theme-preview.js";

describe("theme preview", () => {
  test("paletteForTheme returns darkPalette for 'dark'", () => {
    expect(paletteForTheme("dark", lightPalette)).toBe(darkPalette);
  });

  test("paletteForTheme returns lightPalette for 'light'", () => {
    expect(paletteForTheme("light", darkPalette)).toBe(lightPalette);
  });

  test.each([
    { active: darkPalette, label: "dark" },
    { active: lightPalette, label: "light" },
  ])("paletteForTheme on 'auto' returns the terminal-detected $label palette", ({ active }) => {
    expect(paletteForTheme("auto", active)).toBe(active);
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
