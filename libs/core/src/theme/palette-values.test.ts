import { describe, expect, it } from "vitest";
import { DARK_PALETTE_VALUES, LIGHT_PALETTE_VALUES } from "./palette-values.js";
import { THEME_TOKEN_KEYS } from "./token-keys.js";

const PALETTES = [
  ["dark", DARK_PALETTE_VALUES],
  ["light", LIGHT_PALETTE_VALUES],
] as const;

// `bg` is the background these are measured against and `border` only ever
// paints rules and outlines, never normal-size text.
const TEXT_TOKEN_KEYS = THEME_TOKEN_KEYS.filter((key) => key !== "bg" && key !== "border");
const WCAG_AA_NORMAL_TEXT = 4.5;

function channelLuminance(channel: number): number {
  const ratio = channel / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channelLuminance((value >> 16) & 0xff) +
    0.7152 * channelLuminance((value >> 8) & 0xff) +
    0.0722 * channelLuminance(value & 0xff)
  );
}

function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("canonical palette values", () => {
  it.each(PALETTES)("defines one hex value for every %s theme token", (_theme, palette) => {
    expect(Object.keys(palette)).toEqual(THEME_TOKEN_KEYS);
    expect(Object.values(palette).every((value) => /^#[0-9a-f]{6}$/.test(value))).toBe(true);
  });

  it.each(PALETTES)("keeps every %s text token at WCAG AA against its background", (_, palette) => {
    const belowThreshold = TEXT_TOKEN_KEYS.filter(
      (key) => contrastRatio(palette[key], palette.bg) < WCAG_AA_NORMAL_TEXT,
    );

    expect(belowThreshold).toEqual([]);
  });
});
