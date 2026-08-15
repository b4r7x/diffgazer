import type { ThemeTokenKey } from "./token-keys.js";

/**
 * Per-app theme token map. CLI palettes resolve to hex strings; web maps to
 * CSS variable names (`var(--base-bg)`) or Tailwind class fragments.
 */
export type ThemeTokens = Record<ThemeTokenKey, string>;
