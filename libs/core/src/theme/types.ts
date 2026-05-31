import type { ThemeTokenKey } from "./token-keys.js";

/**
 * Per-app theme token map. CLI palettes resolve to hex strings; web maps to
 * CSS variable names (`var(--tui-bg)`) or Tailwind class fragments. The
 * generic parameter exists so callers can keep their string subtype (literal
 * hex) when annotating concrete palettes.
 */
export type ThemeTokens<TValue extends string = string> = Record<
  ThemeTokenKey,
  TValue
>;
