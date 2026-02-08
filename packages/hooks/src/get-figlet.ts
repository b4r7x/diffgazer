import figlet from "figlet";

import bigFont from "figlet/importable-fonts/Big.js";
import smallFont from "figlet/importable-fonts/Small.js";

export type FigletFont = "Big" | "Small";

const loadedFonts = new Set<FigletFont>();

function ensureFont(font: FigletFont): void {
  if (loadedFonts.has(font)) return;
  figlet.parseFont(font, font === "Big" ? bigFont : smallFont);
  loadedFonts.add(font);
}

export function getFigletText(
  inputText: string,
  font: FigletFont = "Big",
): string | null {
  try {
    ensureFont(font);
    return figlet.textSync(inputText.toUpperCase(), { font });
  } catch {
    return null;
  }
}
