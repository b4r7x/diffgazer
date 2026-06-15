import figlet from "figlet";

import bigFont from "figlet/importable-fonts/Big.js";

/**
 * Synchronous figlet banner renderer for the Node CLI, where figlet and its
 * fonts are bundled dependencies that can be loaded eagerly.
 *
 * This intentionally diverges from the browser counterpart in
 * `libs/ui/registry/ui/logo/figlet-text.ts`, which loads figlet and its
 * fonts via async dynamic `import()` because figlet is an optional peer there
 * and must be code-split out of the browser bundle. The two implementations
 * are kept separate on purpose: a shared module would force one runtime's
 * loading strategy (sync-eager vs async-lazy) onto the other.
 */

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
