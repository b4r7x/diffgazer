import {
  PRIMITIVE_TOKEN_KEYS,
  SEMANTIC_TOKEN_KEYS,
  SEVERITY_TOKEN_KEYS,
  STATUS_TOKEN_KEYS,
  type ThemeTokenKey,
} from "@diffgazer/core/theme";
import { type CliColorTokens, darkPalette, lightPalette } from "../../../theme/palettes";
import { detectDefaultPalette } from "../../../theme/provider";
import type { CliTheme } from "../components/theme-selector";

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

export function paletteForTheme(theme: CliTheme): CliColorTokens {
  if (theme === "dark") return darkPalette;
  if (theme === "light") return lightPalette;
  return detectDefaultPalette().tokens;
}
