import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { THEME_TOKEN_KEYS } from "@diffgazer/core/theme";
import { darkPalette, lightPalette } from "../../../theme/palettes.js";
import { TOKEN_GROUPS, paletteForTheme } from "./theme-screen-preview.js";

describe("theme-screen-preview", () => {
  test("paletteForTheme returns darkPalette for 'dark'", () => {
    assert.equal(paletteForTheme("dark", lightPalette), darkPalette);
  });

  test("paletteForTheme returns lightPalette for 'light'", () => {
    assert.equal(paletteForTheme("light", darkPalette), lightPalette);
  });

  test("paletteForTheme returns the active palette for 'auto' (terminal-detected)", () => {
    assert.equal(paletteForTheme("auto", darkPalette), darkPalette);
    assert.equal(paletteForTheme("auto", lightPalette), lightPalette);
  });

  test("TOKEN_GROUPS covers every key in the cross-app vocabulary exactly once", () => {
    const flattened = TOKEN_GROUPS.flatMap((g) => g.keys);
    const unique = new Set(flattened);
    assert.equal(flattened.length, unique.size, "no key should appear in two groups");
    assert.equal(unique.size, THEME_TOKEN_KEYS.length);
    for (const key of THEME_TOKEN_KEYS) {
      assert.ok(unique.has(key), `THEME_TOKEN_KEYS member '${key}' missing from grid groups`);
    }
  });

  test("TOKEN_GROUPS keeps the canonical primitive → semantic → severity → status order", () => {
    assert.deepEqual(
      TOKEN_GROUPS.map((g) => g.title),
      ["Primitive", "Semantic", "Severity", "Status"],
    );
  });
});
