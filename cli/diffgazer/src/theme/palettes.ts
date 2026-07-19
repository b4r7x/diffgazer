import {
  DARK_PALETTE_VALUES,
  LIGHT_PALETTE_VALUES,
  type ThemeTokenKey,
} from "@diffgazer/core/theme";

/**
 * CLI palettes implement the cross-app theme token contract from
 * `@diffgazer/core/theme`. Adding or removing a key here without updating
 * `THEME_TOKEN_KEYS` (or vice versa) is a compile error.
 */
export type CliColorTokens = Record<ThemeTokenKey, string>;

type Palette = CliColorTokens;

export const darkPalette: Palette = DARK_PALETTE_VALUES;

export const lightPalette: Palette = LIGHT_PALETTE_VALUES;

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
