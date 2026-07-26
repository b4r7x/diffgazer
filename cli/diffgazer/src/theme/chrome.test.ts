import { describe, expect, test } from "vitest";
import {
  focusBorder,
  paneBorder,
  RETICLE_BORDER,
  rowTone,
  SURFACE_BORDER,
  selectionHue,
} from "./chrome";
import type { CliColorTokens } from "./palettes";
import { darkPalette, highContrastPalette, lightPalette } from "./palettes";

const PALETTES: [string, CliColorTokens][] = [
  ["dark", darkPalette],
  ["light", lightPalette],
  ["high-contrast", highContrastPalette],
];

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const channel = (offset: number) => {
    const raw = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return raw <= 0.04045 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrast(a: string, b: string): number {
  const [first, second] = [luminance(a), luminance(b)];
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("selection fill", () => {
  test.each(PALETTES)("%s selects in the blue family, never in accent", (_name, tokens) => {
    expect(selectionHue(tokens)).toBe(tokens.blue);
    expect(selectionHue(tokens)).not.toBe(tokens.accent);
  });

  test.each(PALETTES)("%s keeps row text on the fill above 4.5:1", (_name, tokens) => {
    const tone = rowTone(tokens, { isHighlighted: true });
    expect(contrast(tone.primary, selectionHue(tokens))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tone.secondary, selectionHue(tokens))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("focusBorder", () => {
  test.each(PALETTES)("%s draws a focused pane border in the blue family", (_name, tokens) => {
    expect(focusBorder(tokens, true)).toBe(tokens.blue);
    expect(focusBorder(tokens, true)).not.toBe(tokens.accent);
  });

  test.each(PALETTES)("%s leaves a resting pane on the hairline border", (_name, tokens) => {
    expect(focusBorder(tokens, false)).toBe(tokens.border);
    expect(focusBorder(tokens, false)).not.toBe(focusBorder(tokens, true));
  });

  test.each(PALETTES)("%s borders a focused pane in the row hue too", (_name, tokens) => {
    // Pane and row read as one focus language: same hue, told apart by form —
    // a border around the pane against a fill under the row.
    expect(focusBorder(tokens, true)).toBe(selectionHue(tokens));
  });
});

describe("paneBorder", () => {
  test.each(PALETTES)("%s rests on the plain hairline in the border token", (_name, tokens) => {
    expect(paneBorder(tokens, false)).toEqual({
      borderStyle: SURFACE_BORDER,
      borderColor: tokens.border,
    });
  });

  test.each(PALETTES)("%s draws the reticle in the focus hue when focused", (_name, tokens) => {
    expect(paneBorder(tokens, true)).toEqual({
      borderStyle: RETICLE_BORDER,
      borderColor: selectionHue(tokens),
    });
  });

  test("keeps the reticle edges light and steps only the corners up", () => {
    expect([
      RETICLE_BORDER.top,
      RETICLE_BORDER.bottom,
      RETICLE_BORDER.left,
      RETICLE_BORDER.right,
    ]).toEqual(["─", "─", "│", "│"]);
    expect([
      RETICLE_BORDER.topLeft,
      RETICLE_BORDER.topRight,
      RETICLE_BORDER.bottomLeft,
      RETICLE_BORDER.bottomRight,
    ]).toEqual(["┏", "┓", "┗", "┛"]);
  });
});

describe("rowTone", () => {
  test("paints the highlighted row of a focused list", () => {
    const tone = rowTone(darkPalette, { isHighlighted: true });
    expect(tone.background).toBe(selectionHue(darkPalette));
    expect(tone.primary).toBe(darkPalette.bg);
  });

  test("names the highlighted row without painting it while the list is inactive", () => {
    const tone = rowTone(darkPalette, { isHighlighted: true, isActive: false });
    expect(tone.background).toBeUndefined();
    expect(tone.primary).toBe(selectionHue(darkPalette));
    expect(tone.secondary).toBe(darkPalette.muted);
  });

  test("leaves rows that are not highlighted alone in either state", () => {
    for (const isActive of [true, false]) {
      const tone = rowTone(darkPalette, { isHighlighted: false, isActive });
      expect(tone.background).toBeUndefined();
      expect(tone.primary).toBe(darkPalette.fg);
    }
  });

  test("lets a caller override the fill, as a destructive menu row does", () => {
    const tone = rowTone(darkPalette, { isHighlighted: true, fill: darkPalette.error });
    expect(tone.background).toBe(darkPalette.error);
  });
});
