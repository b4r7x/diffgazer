import type { Theme } from "@diffgazer/core/schemas/config";

/**
 * The web app renders two themes. The shared config schema is wider — the TUI
 * still uses "auto" and "terminal" — so config values are narrowed on read.
 */
export type WebTheme = Extract<Theme, "dark" | "light">;

export interface ThemeContextValue {
  theme: WebTheme;
  setTheme: (theme: WebTheme) => Promise<void>;
}

export function isWebTheme(value: string | null): value is WebTheme {
  return value === "dark" || value === "light";
}
