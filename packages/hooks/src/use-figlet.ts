import figlet from "figlet";

import bigFont from "figlet/importable-fonts/Big.js";
import smallFont from "figlet/importable-fonts/Small.js";

figlet.parseFont("Big", bigFont);
figlet.parseFont("Small", smallFont);

export type FigletFont = "Big" | "Small";

export function useFiglet(
  inputText: string,
  font: FigletFont = "Big",
): string | null {
  try {
    return figlet.textSync(inputText.toUpperCase(), { font });
  } catch {
    return null;
  }
}
