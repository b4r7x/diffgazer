import type { ResolvedTheme } from "@/types/theme";

/**
 * The reader's stored theme choice. `index.html` runs a parser-blocking inline
 * copy of the resolution below before first paint; everything after hydration
 * goes through {@link applyResolvedTheme}. `theme-bootstrap.test.ts` executes
 * the shipped inline script against these exports, so the two cannot drift.
 */
export const THEME_STORAGE_KEY = "diffgazer-theme";

/** The browser-chrome color per resolved theme, mirrored by that inline script. */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  dark: "#0d1117",
  light: "#ffffff",
};

/** Stamps the resolved theme onto the document the inline script already themed. */
export function applyResolvedTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[theme]);
}
