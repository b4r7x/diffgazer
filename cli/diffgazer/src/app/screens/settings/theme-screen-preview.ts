import {
  PRIMITIVE_TOKEN_KEYS,
  SEMANTIC_TOKEN_KEYS,
  SEVERITY_TOKEN_KEYS,
  STATUS_TOKEN_KEYS,
  type ThemeTokenKey,
} from "@diffgazer/core/theme";
import {
  darkPalette,
  lightPalette,
  type CliColorTokens,
} from "../../../theme/palettes";
import type { CliTheme } from "../../../features/settings/components/theme-selector";

/** Palette swatch grouping shown in the Live Preview panel. */
export const TOKEN_GROUPS: ReadonlyArray<{
  title: string;
  keys: ReadonlyArray<ThemeTokenKey>;
}> = [
  { title: "Primitive", keys: PRIMITIVE_TOKEN_KEYS },
  { title: "Semantic", keys: SEMANTIC_TOKEN_KEYS },
  { title: "Severity", keys: SEVERITY_TOKEN_KEYS },
  { title: "Status", keys: STATUS_TOKEN_KEYS },
];

/**
 * Map a picker selection to a palette for the preview panel.
 * `auto` keeps the currently-active palette so the preview reflects what the
 * user will see after saving "auto" on this terminal.
 */
export function paletteForTheme(
  theme: CliTheme,
  activePalette: CliColorTokens,
): CliColorTokens {
  if (theme === "dark") return darkPalette;
  if (theme === "light") return lightPalette;
  return activePalette;
}
