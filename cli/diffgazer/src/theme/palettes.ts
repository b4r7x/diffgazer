import type { ThemeTokenKey } from "@diffgazer/core/theme";

/**
 * CLI palettes implement the cross-app theme token contract from
 * `@diffgazer/core/theme`. Adding or removing a key here without updating
 * `THEME_TOKEN_KEYS` (or vice versa) is a compile error.
 */
export type CliColorTokens = Record<ThemeTokenKey, string>;

type Palette = CliColorTokens;

// GitHub Dark Default theme colors
export const darkPalette: Palette = {
  bg: "#0d1117",
  fg: "#e6edf3",
  blue: "#58a6ff",
  violet: "#bc8cff",
  green: "#3fb950",
  red: "#f85149",
  yellow: "#d29922",
  border: "#30363d",
  muted: "#8b949e",
  success: "#3fb950",
  warning: "#d29922",
  error: "#f85149",
  info: "#58a6ff",
  accent: "#bc8cff",
  severityBlocker: "#f85149",
  severityHigh: "#f0883e",
  severityMedium: "#d29922",
  severityLow: "#58a6ff",
  severityNit: "#8b949e",
  statusRunning: "#58a6ff",
  statusComplete: "#3fb950",
  statusPending: "#8b949e",
};

// GitHub Light Default theme colors
export const lightPalette: Palette = {
  bg: "#ffffff",
  fg: "#1f2328",
  blue: "#0969da",
  violet: "#8250df",
  green: "#1a7f37",
  red: "#cf222e",
  yellow: "#9a6700",
  border: "#d0d7de",
  muted: "#656d76",
  success: "#1a7f37",
  warning: "#9a6700",
  error: "#cf222e",
  info: "#0969da",
  accent: "#8250df",
  severityBlocker: "#cf222e",
  severityHigh: "#bc4c00",
  severityMedium: "#9a6700",
  severityLow: "#0969da",
  severityNit: "#656d76",
  statusRunning: "#0969da",
  statusComplete: "#1a7f37",
  statusPending: "#656d76",
};

export const highContrastPalette: Palette = {
  bg: "#000000",
  fg: "#ffffff",
  blue: "#00ffff",
  violet: "#ff00ff",
  green: "#00ff00",
  red: "#ff5f5f",
  yellow: "#ffff00",
  border: "#ffffff",
  muted: "#b3b3b3",
  success: "#00ff00",
  warning: "#ffff00",
  error: "#ff5f5f",
  info: "#00ffff",
  accent: "#ff00ff",
  severityBlocker: "#ff5f5f",
  severityHigh: "#ffaf00",
  severityMedium: "#ffff00",
  severityLow: "#00ffff",
  severityNit: "#b3b3b3",
  statusRunning: "#00ffff",
  statusComplete: "#00ff00",
  statusPending: "#b3b3b3",
};

export const PALETTE_NAMES = ["dark", "light", "high-contrast"] as const;
export type PaletteName = (typeof PALETTE_NAMES)[number];

export const TUI_THEME_NAMES = ["auto", ...PALETTE_NAMES] as const;
export type TuiThemeName = (typeof TUI_THEME_NAMES)[number];

export const palettes = {
  dark: darkPalette,
  light: lightPalette,
  "high-contrast": highContrastPalette,
} satisfies Record<PaletteName, Palette>;

export function isPaletteName(name: string): name is PaletteName {
  return Object.hasOwn(palettes, name);
}

export function isTuiThemeName(name: string): name is TuiThemeName {
  return name === "auto" || isPaletteName(name);
}
