import figlet from "figlet";

import bigFont from "figlet/importable-fonts/Big.js";

/** @see libs/ui/registry/ui/logo/get-figlet-text.ts for the intentionally duplicated copy. */

let fontLoaded = false;

function ensureFont(): void {
  if (fontLoaded) return;
  figlet.parseFont("Big", bigFont);
  fontLoaded = true;
}

export function getFigletText(inputText: string): string | null {
  try {
    ensureFont();
    return figlet.textSync(inputText.toUpperCase(), { font: "Big" });
  } catch {
    return null;
  }
}
