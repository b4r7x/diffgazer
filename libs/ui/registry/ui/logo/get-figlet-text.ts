import figlet from "figlet"
import bigFont from "figlet/importable-fonts/Big.js"
import smallFont from "figlet/importable-fonts/Small.js"

figlet.parseFont("Big", bigFont)
figlet.parseFont("Small", smallFont)

/** Supported figlet font names. @see diffgazer/packages/core/src/get-figlet.ts for the canonical copy. */
export type FigletFont = "Big" | "Small"

export function getFigletText(
  text: string,
  font: FigletFont = "Big",
): string | null {
  try {
    return figlet.textSync(text, { font })
  } catch {
    return null
  }
}
