export interface ThemeDocsToken {
  name: `--${string}`;
  darkValue: string;
  lightValue: string;
}

export interface ThemeDocsPrimitive extends ThemeDocsToken {
  semanticTokens: readonly ThemeDocsToken["name"][];
}

export interface ThemeDocsTokenGroup {
  title: string;
  tokens: readonly ThemeDocsToken[];
}

function primitive(
  name: ThemeDocsPrimitive["name"],
  darkValue: string,
  lightValue: string,
  semanticTokens: readonly ThemeDocsToken["name"][] = [],
): ThemeDocsPrimitive {
  return { name, darkValue, lightValue, semanticTokens };
}

function token(
  name: ThemeDocsToken["name"],
  darkValue: string,
  lightValue: string,
): ThemeDocsToken {
  return { name, darkValue, lightValue };
}

const BG = "--tui-bg" as const;
const FG = "--tui-fg" as const;
const DIM = "--tui-dim" as const;
const BORDER = "--tui-border" as const;
const HIGHLIGHT = "--tui-highlight" as const;
const HIGHLIGHT_FG = "--tui-highlight-fg" as const;
const INPUT_BG = "--tui-input-bg" as const;
const MUTED = "--tui-muted" as const;
const SELECTION = "--tui-selection" as const;
const BLUE = "--tui-blue" as const;
const VIOLET = "--tui-violet" as const;
const GREEN = "--tui-green" as const;
const RED = "--tui-red" as const;
const YELLOW = "--tui-yellow" as const;

const WHITE = "#ffffff";

const ref = (name: ThemeDocsToken["name"]) => `var(${name})`;

export const THEME_DOCS_PRIMITIVES = [
  primitive(BG, "#0a0a0a", "#f7f8f5", ["--background"]),
  primitive(FG, "#e5e5e5", "#1f2328", ["--foreground"]),
  primitive(DIM, "#9c9c9c", "#5f6872", ["--muted-foreground"]),
  primitive(BLUE, "#ccccff", "#0b63ce", ["--info", "--ring"]),
  primitive(VIOLET, "#787878", "#6f42c1", ["--accent", "--action"]),
  primitive(GREEN, "#e5e5e5", "#0f7a4f", ["--success"]),
  primitive(RED, "#ff7b72", "#c62828", ["--destructive", "--error"]),
  primitive(YELLOW, "#d29922", "#8a5a00", ["--warning"]),
  primitive(BORDER, "#606060", "#aeb7c0", ["--border"]),
  primitive(HIGHLIGHT, "#ffffff", "#1f2328", ["--primary"]),
  primitive(HIGHLIGHT_FG, "#000000", "#ffffff"),
  primitive(SELECTION, "#333333", "#e8edf3", ["--secondary"]),
  primitive(MUTED, "#787878", "#69717a", ["--muted"]),
  primitive(INPUT_BG, "#0a0a0a", "#ffffff", ["--card", "--popover", "--input"]),
] as const satisfies readonly ThemeDocsPrimitive[];

const themeDocsPrimitiveByName = new Map(
  THEME_DOCS_PRIMITIVES.map((primitive) => [primitive.name, primitive] as const),
);

function getThemeDocsPrimitive(name: ThemeDocsPrimitive["name"]): ThemeDocsPrimitive {
  const primitive = themeDocsPrimitiveByName.get(name);
  if (!primitive) {
    throw new Error(`Unknown TUI primitive in display order: ${name}`);
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
  token("--destructive", ref(RED), ref(RED)),
  token("--destructive-foreground", ref(BG), WHITE),
  token("--accent", ref(HIGHLIGHT), ref(VIOLET)),
  token("--accent-foreground", ref(HIGHLIGHT_FG), ref(HIGHLIGHT_FG)),
  token("--card", ref(SELECTION), ref(INPUT_BG)),
  token("--card-foreground", ref(FG), ref(FG)),
  token("--popover", ref(SELECTION), ref(INPUT_BG)),
  token("--popover-foreground", ref(FG), ref(FG)),
  token("--ring", ref(FG), ref(BLUE)),
  token("--success", ref(GREEN), ref(GREEN)),
  token("--success-foreground", ref(BG), WHITE),
  token("--warning", ref(YELLOW), ref(YELLOW)),
  token("--warning-foreground", ref(BG), WHITE),
  token("--info", ref(BLUE), ref(BLUE)),
  token("--info-foreground", ref(BG), WHITE),
  token("--error", ref(RED), ref(RED)),
  token("--error-foreground", ref(BG), WHITE),
  token("--action", ref(HIGHLIGHT), ref(VIOLET)),
  token("--action-foreground", ref(HIGHLIGHT_FG), WHITE),
] as const satisfies readonly ThemeDocsToken[];

export const THEME_DOCS_TONE_TOKENS = [
  token("--success-subtle", "#e5e5e51a", "#0f7a4f1f"),
  token("--success-fg", ref(GREEN), ref(GREEN)),
  token("--success-border", ref(GREEN), ref(GREEN)),
  token("--success-strong", ref(GREEN), ref(GREEN)),
  token("--success-strong-foreground", ref(BG), WHITE),
  token("--warning-subtle", "#d299220d", "#8a5a0014"),
  token("--warning-fg", ref(YELLOW), ref(YELLOW)),
  token("--warning-border", ref(YELLOW), ref(YELLOW)),
  token("--warning-strong", ref(YELLOW), ref(YELLOW)),
  token("--warning-strong-foreground", ref(BG), WHITE),
  token("--error-subtle", "#ff7b721a", "#c628281a"),
  token("--error-fg", ref(RED), ref(RED)),
  token("--error-border", ref(RED), ref(RED)),
  token("--error-strong", ref(RED), ref(RED)),
  token("--error-strong-foreground", ref(BG), WHITE),
  token("--info-subtle", "#ccccff1a", "#0b63ce1a"),
  token("--info-fg", ref(BLUE), ref(BLUE)),
  token("--info-border", ref(BLUE), ref(BLUE)),
  token("--info-strong", ref(BLUE), ref(BLUE)),
  token("--info-strong-foreground", ref(BG), WHITE),
  token("--neutral-subtle", "#6666661a", "#aeb7c014"),
  token("--neutral-border", ref(BORDER), ref(BORDER)),
  token("--neutral-fg", ref(MUTED), ref(MUTED)),
  token("--neutral-strong", ref(MUTED), ref(MUTED)),
  token("--neutral-strong-foreground", ref(BG), WHITE),
] as const satisfies readonly ThemeDocsToken[];

export const THEME_DOCS_CODE_TOKENS = [
  token("--code-comment", ref(DIM), ref(DIM)),
  token("--code-string", ref(VIOLET), ref(VIOLET)),
  token("--code-number", ref(VIOLET), ref(VIOLET)),
  token("--code-keyword", ref(BLUE), ref(BLUE)),
  token("--code-function", ref(GREEN), ref(GREEN)),
  token("--code-tag", ref(GREEN), ref(GREEN)),
  token("--code-attr", ref(BLUE), ref(BLUE)),
  token("--code-parameter", ref(YELLOW), ref(YELLOW)),
  token("--code-operator", ref(RED), ref(RED)),
  token("--code-variable", ref(FG), ref(FG)),
  token("--code-type", ref(BLUE), ref(BLUE)),
] as const satisfies readonly ThemeDocsToken[];

export const THEME_DOCS_SURFACE_TOKENS = [
  token("--surface-1", "#111111", "#ffffff"),
] as const satisfies readonly ThemeDocsToken[];

const THEME_DOCS_VARIABLE_DIAGRAM_ORDER = [
  BG,
  FG,
  BLUE,
  GREEN,
  RED,
  YELLOW,
  VIOLET,
  BORDER,
  MUTED,
  HIGHLIGHT,
  SELECTION,
  INPUT_BG,
] as const satisfies readonly ThemeDocsPrimitive["name"][];

export const THEME_DOCS_COLOR_GRID_ORDER = [
  BG,
  FG,
  DIM,
  BLUE,
  GREEN,
  RED,
  YELLOW,
  VIOLET,
  BORDER,
  HIGHLIGHT,
  HIGHLIGHT_FG,
  SELECTION,
  MUTED,
  INPUT_BG,
] as const satisfies readonly ThemeDocsPrimitive["name"][];

export const THEME_DOCS_PLAYGROUND_ORDER = [
  BG,
  FG,
  DIM,
  BLUE,
  VIOLET,
  GREEN,
  RED,
  YELLOW,
  BORDER,
  HIGHLIGHT,
  HIGHLIGHT_FG,
  SELECTION,
  MUTED,
  INPUT_BG,
] as const satisfies readonly ThemeDocsPrimitive["name"][];

export const THEME_DOCS_MAPPED_PRIMITIVES = THEME_DOCS_VARIABLE_DIAGRAM_ORDER.map((name) =>
  getThemeDocsPrimitive(name),
).filter(
  (
    primitive,
  ): primitive is ThemeDocsPrimitive & { semanticTokens: readonly ThemeDocsToken["name"][] } =>
    primitive.semanticTokens.length > 0,
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
  order: readonly ThemeDocsPrimitive["name"][],
): ThemeDocsPrimitive[] {
  if (order.length !== THEME_DOCS_PRIMITIVES.length) {
    throw new Error(
      `Display order lists ${order.length} primitives but THEME_DOCS_PRIMITIVES has ${THEME_DOCS_PRIMITIVES.length}.`,
    );
  }

  const unknown = order.filter((name) => !themeDocsPrimitiveByName.has(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown TUI primitive in display order: ${unknown.join(", ")}`);
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
