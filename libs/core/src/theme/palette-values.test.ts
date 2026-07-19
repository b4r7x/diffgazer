import { describe, expect, it } from "vitest";
import { DARK_PALETTE_VALUES, LIGHT_PALETTE_VALUES } from "./palette-values.js";
import { THEME_TOKEN_KEYS } from "./token-keys.js";

describe("canonical palette values", () => {
  it.each([
    ["dark", DARK_PALETTE_VALUES],
    ["light", LIGHT_PALETTE_VALUES],
  ] as const)("defines one hex value for every %s theme token", (_theme, palette) => {
    expect(Object.keys(palette)).toEqual([...THEME_TOKEN_KEYS]);
    expect(Object.values(palette).every((value) => /^#[0-9a-f]{6}$/.test(value))).toBe(true);
  });
});
