import {
  THEME_DOCS_CODE_TOKENS,
  THEME_DOCS_PRIMITIVES,
  THEME_DOCS_SEMANTIC_TOKENS,
  THEME_DOCS_SURFACE_TOKENS,
  THEME_DOCS_TONE_TOKENS,
  type ThemeDocsPrimitive,
  type ThemeDocsPrimitiveName,
  type ThemeDocsToken,
} from "@diffgazer/ui/theme";

export interface ThemeDocsTokenGroup {
  title: string;
  tokens: readonly ThemeDocsToken[];
}

const themeDocsPrimitiveByName = new Map<ThemeDocsPrimitiveName, ThemeDocsPrimitive>(
  THEME_DOCS_PRIMITIVES.map((primitive) => [primitive.name, primitive] as const),
);

function getThemeDocsPrimitive(name: ThemeDocsPrimitiveName): ThemeDocsPrimitive {
  const primitive = themeDocsPrimitiveByName.get(name);
  if (!primitive) {
    throw new Error(`Unknown base primitive in display order: ${name}`);
  }
  return primitive;
}

const THEME_DOCS_VARIABLE_DIAGRAM_ORDER = [
  "--base-bg",
  "--base-fg",
  "--base-info",
  "--base-success",
  "--base-danger",
  "--base-warning",
  "--base-accent",
  "--base-border",
  "--base-dim",
  "--base-muted",
  "--base-highlight",
  "--base-selection",
  "--base-input-bg",
] as const satisfies readonly ThemeDocsPrimitiveName[];

export const THEME_DOCS_COLOR_GRID_ORDER = [
  "--base-bg",
  "--base-fg",
  "--base-dim",
  "--base-info",
  "--base-success",
  "--base-danger",
  "--base-warning",
  "--base-accent",
  "--base-border",
  "--base-highlight",
  "--base-highlight-foreground",
  "--base-selection",
  "--base-muted",
  "--base-input-bg",
] as const satisfies readonly ThemeDocsPrimitiveName[];

export const THEME_DOCS_PLAYGROUND_ORDER = [
  "--base-bg",
  "--base-fg",
  "--base-dim",
  "--base-info",
  "--base-accent",
  "--base-success",
  "--base-danger",
  "--base-warning",
  "--base-border",
  "--base-highlight",
  "--base-highlight-foreground",
  "--base-selection",
  "--base-muted",
  "--base-input-bg",
] as const satisfies readonly ThemeDocsPrimitiveName[];

export const THEME_DOCS_MAPPED_PRIMITIVES = THEME_DOCS_VARIABLE_DIAGRAM_ORDER.map((name) =>
  getThemeDocsPrimitive(name),
).filter(
  (primitive) =>
    primitive.semanticTokens.dark.length > 0 || primitive.semanticTokens.light.length > 0,
);

export const THEME_DOCS_COLOR_GROUPS = [
  { title: "Primitives", tokens: orderThemeDocsPrimitives(THEME_DOCS_COLOR_GRID_ORDER) },
  { title: "Semantic Tokens", tokens: THEME_DOCS_SEMANTIC_TOKENS },
  { title: "Tone Variants", tokens: THEME_DOCS_TONE_TOKENS },
  { title: "Code Syntax", tokens: THEME_DOCS_CODE_TOKENS },
  { title: "Surface Tokens", tokens: THEME_DOCS_SURFACE_TOKENS },
] as const satisfies readonly ThemeDocsTokenGroup[];

export const THEME_DOCS_TOKENS = THEME_DOCS_COLOR_GROUPS.flatMap((group) => group.tokens);

export function orderThemeDocsPrimitives(
  order: readonly ThemeDocsPrimitiveName[],
): ThemeDocsPrimitive[] {
  if (order.length !== THEME_DOCS_PRIMITIVES.length) {
    throw new Error(
      `Display order lists ${order.length} primitives but THEME_DOCS_PRIMITIVES has ${THEME_DOCS_PRIMITIVES.length}.`,
    );
  }

  const missing = THEME_DOCS_PRIMITIVES.map((primitive) => primitive.name).filter(
    (name) => !order.includes(name),
  );
  if (missing.length > 0) {
    throw new Error(`Display order is missing primitives: ${missing.join(", ")}`);
  }

  if (new Set(order).size !== order.length) {
    throw new Error("Display order contains duplicate primitives.");
  }

  return order.map((name) => getThemeDocsPrimitive(name));
}
