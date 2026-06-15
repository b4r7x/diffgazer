import type figlet from "figlet";

/**
 * Renders static text or caller-provided ASCII art without loading figlet from the default
 * component export.
 */
export type FigletFont = "Big" | "Small";

type FigletModule = typeof figlet;

const FONT_FILES: Record<FigletFont, string> = {
  Big: "figlet/importable-fonts/Big.js",
  Small: "figlet/importable-fonts/Small.js",
};

const MISSING_DEPENDENCY_MESSAGE =
  "@diffgazer/ui/components/logo/figlet requires the optional peer dependency 'figlet'. Install it with: npm install figlet";

let figletPromise: Promise<FigletModule> | null = null;
const fontPromises = new Map<FigletFont, Promise<void>>();

function loadFiglet(): Promise<FigletModule> {
  if (!figletPromise) {
    figletPromise = import("figlet")
      .then((mod) => (mod.default ?? mod) as FigletModule)
      .catch(() => {
        throw new Error(MISSING_DEPENDENCY_MESSAGE);
      });
  }
  return figletPromise;
}

function loadFont(figletModule: FigletModule, font: FigletFont): Promise<void> {
  let promise = fontPromises.get(font);
  if (!promise) {
    promise = import(/* @vite-ignore */ FONT_FILES[font])
      .then((mod) => {
        const data = (mod.default ?? mod) as string;
        figletModule.parseFont(font, data);
      })
      .catch(() => {
        throw new Error(MISSING_DEPENDENCY_MESSAGE);
      });
    fontPromises.set(font, promise);
  }
  return promise;
}

/** Returns figlet text. */
export async function getFigletText(text: string, font: FigletFont = "Big"): Promise<string> {
  const figletModule = await loadFiglet();
  await loadFont(figletModule, font);
  return figletModule.textSync(text, { font });
}
