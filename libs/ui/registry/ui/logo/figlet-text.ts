import type figlet from "figlet";

/** Font names supported by the optional figlet loader. */
export type FigletFont = "Big" | "Small";

type FigletModule = typeof figlet;

type FontModule = { default: string } | string;

const FONT_LOADERS: Record<FigletFont, () => Promise<FontModule>> = {
  Big: () => import("figlet/importable-fonts/Big.js"),
  Small: () => import("figlet/importable-fonts/Small.js"),
};

const MISSING_DEPENDENCY_MESSAGE =
  "Logo figlet rendering requires the optional peer dependency 'figlet'. Install it with: npm install figlet";

let figletPromise: Promise<FigletModule> | null = null;
const fontPromises = new Map<FigletFont, Promise<void>>();

function loadFiglet(): Promise<FigletModule> {
  if (!figletPromise) {
    figletPromise = import("figlet")
      .then((mod) => (mod.default ?? mod) as FigletModule)
      .catch(() => {
        figletPromise = null;
        throw new Error(MISSING_DEPENDENCY_MESSAGE);
      });
  }
  return figletPromise;
}

function loadFont(figletModule: FigletModule, font: FigletFont): Promise<void> {
  let promise = fontPromises.get(font);
  if (!promise) {
    promise = FONT_LOADERS[font]()
      .then((mod) => (typeof mod === "string" ? mod : mod.default))
      .then((data) => {
        figletModule.parseFont(font, data);
      })
      .catch((error: unknown) => {
        fontPromises.delete(font);
        // figlet itself already resolved, so this is a chunk or font-data
        // failure; keep the real cause instead of blaming the peer dependency.
        throw new Error(`Failed to load the figlet font "${font}".`, { cause: error });
      });
    fontPromises.set(font, promise);
  }
  return promise;
}

export async function getFigletText(text: string, font: FigletFont = "Big"): Promise<string> {
  const figletModule = await loadFiglet();
  await loadFont(figletModule, font);
  return figletModule.textSync(text, { font });
}
