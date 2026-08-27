import type { RegistryItem } from "@diffgazer/registry/schemas";
import { transformUiPublicRegistryItem } from "./registry-dependencies.js";
import { stripThemeStylesFromSource, type ThemeStyleStripPolicy } from "./theme-style-dedupe.js";
import { applyUiRegistryTargets } from "./ui-registry-targets.js";

// Single source of truth for the source→public item shape: direct-URL registry
// dependencies plus the derived `@ui/` file targets. Used both to build the public
// item and to compute the expected item during freshness validation.
export function transformUiPublicRegistrySourceItem(
  item: RegistryItem,
  options: {
    stylePolicy?: ThemeStyleStripPolicy;
    readSourceFile?: (path: string) => string;
  } = {},
): RegistryItem {
  return applyUiRegistryTargets(
    transformUiPublicRegistryItem(
      stripThemeStylesFromSource(item, options.stylePolicy, options.readSourceFile),
    ),
  );
}
