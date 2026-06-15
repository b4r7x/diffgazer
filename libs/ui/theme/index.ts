export interface ThemeDocsToken {
  name: `--${string}`;
  darkValue: string;
  lightValue: string;
}

export interface ThemeDocsPrimitiveSemanticTokens {
  dark: readonly ThemeDocsToken["name"][];
  light: readonly ThemeDocsToken["name"][];
}

export interface ThemeDocsPrimitive<N extends `--${string}` = `--${string}`> {
  name: N;
  darkValue: string;
  lightValue: string;
  semanticTokens: ThemeDocsPrimitiveSemanticTokens;
}

export interface ThemeDocsTokenGroup {
  title: string;
  tokens: readonly ThemeDocsToken[];
}

const EMPTY_SEMANTIC_TOKENS: ThemeDocsPrimitiveSemanticTokens = { dark: [], light: [] };

function primitive<const N extends `--${string}`>(
  name: N,
  darkValue: string,
  lightValue: string,
  semanticTokens: ThemeDocsPrimitiveSemanticTokens = EMPTY_SEMANTIC_TOKENS,
): ThemeDocsPrimitive<N> {
  return { name, darkValue, lightValue, semanticTokens };
}

function token(
  name: ThemeDocsToken["name"],
  darkValue: string,
  lightValue: string,
): ThemeDocsToken {
  return { name, darkValue, lightValue };
}

const BG = "--base-bg" as const;
const FG = "--base-fg" as const;
const DIM = "--base-dim" as const;
const BORDER = "--base-border" as const;
const HIGHLIGHT = "--base-highlight" as const;
const HIGHLIGHT_FG = "--base-highlight-foreground" as const;
const INPUT_BG = "--base-input-bg" as const;
const MUTED = "--base-muted" as const;
const SELECTION = "--base-selection" as const;
const INFO = "--base-info" as const;
const ACCENT = "--base-accent" as const;
const SUCCESS = "--base-success" as const;
const DANGER = "--base-danger" as const;
const WARNING = "--base-warning" as const;

const WHITE = "#ffffff";

const ref = (name: ThemeDocsToken["name"]) => `var(${name})`;
const mix = (name: ThemeDocsToken["name"], percent: number) =>
  `color-mix(in oklab, var(${name}) ${percent}%, transparent)`;

export const THEME_DOCS_PRIMITIVES = [
  primitive(BG, "#0a0a0a", "#f7f8f5", { dark: ["--background"], light: ["--background"] }),
  primitive(FG, "#e5e5e5", "#1f2328", {
    dark: ["--foreground", "--primary", "--ring"],
    light: ["--foreground"],
  }),
  primitive(DIM, "#9c9c9c", "#5f6872", { dark: [], light: [] }),
  primitive(INFO, "#ccccff", "#0b63ce", { dark: ["--info"], light: ["--ring", "--info"] }),
  primitive(ACCENT, "#808080", "#6f42c1", { dark: [], light: ["--accent", "--action"] }),
  primitive(SUCCESS, "#e5e5e5", "#0f7a4f", { dark: ["--success"], light: ["--success"] }),
  primitive(DANGER, "#ff7b72", "#c62828", { dark: ["--error"], light: ["--error"] }),
  primitive(WARNING, "#d29922", "#8a5a00", { dark: ["--warning"], light: ["--warning"] }),
  primitive(BORDER, "#606060", "#aeb7c0", { dark: ["--border"], light: ["--border"] }),
  primitive(HIGHLIGHT, "#ffffff", "#1f2328", {
    dark: ["--accent", "--action"],
    light: ["--primary"],
  }),
  primitive(HIGHLIGHT_FG, "#000000", "#ffffff", { dark: [], light: [] }),
  primitive(SELECTION, "#333333", "#e8edf3", {
    dark: ["--secondary", "--input", "--card", "--popover"],
    light: ["--secondary"],
  }),
  primitive(MUTED, "#808080", "#69717a", { dark: ["--muted"], light: ["--muted"] }),
  primitive(INPUT_BG, "#0a0a0a", "#ffffff", {
    dark: [],
    light: ["--input", "--card", "--popover"],
  }),
] as const satisfies readonly ThemeDocsPrimitive[];

export type ThemeDocsPrimitiveName = (typeof THEME_DOCS_PRIMITIVES)[number]["name"];

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

export const THEME_DOCS_SEMANTIC_TOKENS = [
  token("--background", ref(BG), ref(BG)),
  token("--foreground", ref(FG), ref(FG)),
  token("--primary", ref(FG), ref(HIGHLIGHT)),
  token("--primary-foreground", ref(BG), ref(HIGHLIGHT_FG)),
  token("--secondary", ref(SELECTION), ref(SELECTION)),
  token("--secondary-foreground", ref(FG), ref(FG)),
  token("--muted", ref(MUTED), ref(MUTED)),
  token("--muted-foreground", ref(DIM), ref(DIM)),
  token("--border", ref(BORDER), ref(BORDER)),
  token("--input", ref(SELECTION), ref(INPUT_BG)),
  token("--accent", ref(HIGHLIGHT), ref(ACCENT)),
  token("--accent-foreground", ref(HIGHLIGHT_FG), ref(HIGHLIGHT_FG)),
  token("--card", ref(SELECTION), ref(INPUT_BG)),
  token("--card-foreground", ref(FG), ref(FG)),
  token("--popover", ref(SELECTION), ref(INPUT_BG)),
  token("--popover-foreground", ref(FG), ref(FG)),
  token("--ring", ref(FG), ref(INFO)),
  token("--success", ref(SUCCESS), ref(SUCCESS)),
  token("--success-foreground", ref(BG), WHITE),
  token("--warning", ref(WARNING), ref(WARNING)),
  token("--warning-foreground", ref(BG), WHITE),
  token("--info", ref(INFO), ref(INFO)),
  token("--info-foreground", ref(BG), WHITE),
  token("--error", ref(DANGER), ref(DANGER)),
  token("--error-foreground", ref(BG), WHITE),
  token("--action", ref(HIGHLIGHT), ref(ACCENT)),
  token("--action-foreground", ref(HIGHLIGHT_FG), WHITE),
] as const satisfies readonly ThemeDocsToken[];

export const THEME_DOCS_TONE_TOKENS = [
  token("--success-subtle", mix(SUCCESS, 10), mix(SUCCESS, 12)),
  token("--success-text", ref(SUCCESS), ref(SUCCESS)),
  token("--success-border", ref(SUCCESS), ref(SUCCESS)),
  token("--success-strong", ref(SUCCESS), ref(SUCCESS)),
  token("--success-strong-foreground", ref(BG), WHITE),
  token("--warning-subtle", mix(WARNING, 5), mix(WARNING, 8)),
  token("--warning-text", ref(WARNING), ref(WARNING)),
  token("--warning-border", ref(WARNING), ref(WARNING)),
  token("--warning-strong", ref(WARNING), ref(WARNING)),
  token("--warning-strong-foreground", ref(BG), WHITE),
  token("--error-subtle", mix(DANGER, 10), mix(DANGER, 10)),
  token("--error-text", ref(DANGER), ref(DANGER)),
  token("--error-border", ref(DANGER), ref(DANGER)),
  token("--error-strong", ref(DANGER), ref(DANGER)),
  token("--error-strong-foreground", ref(BG), WHITE),
  token("--info-subtle", mix(INFO, 10), mix(INFO, 10)),
  token("--info-text", ref(INFO), ref(INFO)),
  token("--info-border", ref(INFO), ref(INFO)),
  token("--info-strong", ref(INFO), ref(INFO)),
  token("--info-strong-foreground", ref(BG), WHITE),
  token("--neutral-subtle", mix(BORDER, 10), mix(BORDER, 8)),
  token("--neutral-border", ref(BORDER), ref(BORDER)),
  token("--neutral-text", ref(MUTED), ref(MUTED)),
  token("--neutral-strong", ref(MUTED), ref(MUTED)),
  token("--neutral-strong-foreground", ref(BG), WHITE),
] as const satisfies readonly ThemeDocsToken[];

export const THEME_DOCS_CODE_TOKENS = [
  token("--code-comment", ref(DIM), ref(DIM)),
  token("--code-string", ref(ACCENT), ref(ACCENT)),
  token("--code-number", ref(ACCENT), ref(ACCENT)),
  token("--code-keyword", ref(INFO), ref(INFO)),
  token("--code-function", ref(SUCCESS), ref(SUCCESS)),
  token("--code-tag", ref(SUCCESS), ref(SUCCESS)),
  token("--code-attr", ref(INFO), ref(INFO)),
  token("--code-parameter", ref(WARNING), ref(WARNING)),
  token("--code-operator", ref(DANGER), ref(DANGER)),
  token("--code-variable", ref(FG), ref(FG)),
  token("--code-type", ref(INFO), ref(INFO)),
] as const satisfies readonly ThemeDocsToken[];

export const THEME_DOCS_SURFACE_TOKENS = [
  token("--surface-1", "#111111", "#ffffff"),
] as const satisfies readonly ThemeDocsToken[];

const THEME_DOCS_VARIABLE_DIAGRAM_ORDER = [
  BG,
  FG,
  INFO,
  SUCCESS,
  DANGER,
  WARNING,
  ACCENT,
  BORDER,
  MUTED,
  HIGHLIGHT,
  SELECTION,
  INPUT_BG,
] as const satisfies readonly ThemeDocsPrimitiveName[];

export const THEME_DOCS_COLOR_GRID_ORDER = [
  BG,
  FG,
  DIM,
  INFO,
  SUCCESS,
  DANGER,
  WARNING,
  ACCENT,
  BORDER,
  HIGHLIGHT,
  HIGHLIGHT_FG,
  SELECTION,
  MUTED,
  INPUT_BG,
] as const satisfies readonly ThemeDocsPrimitiveName[];

export const THEME_DOCS_PLAYGROUND_ORDER = [
  BG,
  FG,
  DIM,
  INFO,
  ACCENT,
  SUCCESS,
  DANGER,
  WARNING,
  BORDER,
  HIGHLIGHT,
  HIGHLIGHT_FG,
  SELECTION,
  MUTED,
  INPUT_BG,
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
