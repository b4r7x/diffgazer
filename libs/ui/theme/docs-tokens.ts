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

// Required, not defaulted: theme-parity.test.ts checks every primitive's edges against
// theme.css, so a primitive that omitted them would fail that test rather than fall back.
function primitive<const N extends `--${string}`>(
  name: N,
  darkValue: string,
  lightValue: string,
  semanticTokens: ThemeDocsPrimitiveSemanticTokens,
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
    light: ["--foreground", "--ring"],
  }),
  primitive(DIM, "#9c9c9c", "#5f6872", {
    dark: ["--border-strong"],
    light: ["--border-strong"],
  }),
  primitive(INFO, "#79b8ff", "#0b63ce", { dark: ["--info"], light: ["--info"] }),
  primitive(ACCENT, "#808080", "#6f42c1", { dark: [], light: ["--action"] }),
  primitive(SUCCESS, "#7ee787", "#0f7a4f", { dark: ["--success"], light: ["--success"] }),
  primitive(DANGER, "#ff7b72", "#c62828", { dark: ["--error"], light: ["--error"] }),
  primitive(WARNING, "#d29922", "#8a5a00", { dark: ["--warning"], light: ["--warning"] }),
  primitive(BORDER, "#606060", "#aeb7c0", { dark: ["--border"], light: ["--border"] }),
  primitive(HIGHLIGHT, "#ffffff", "#1f2328", {
    dark: ["--accent", "--action"],
    light: ["--accent", "--primary"],
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
  token("--border-strong", ref(DIM), ref(DIM)),
  token("--input", ref(SELECTION), ref(INPUT_BG)),
  token("--accent", ref(HIGHLIGHT), ref(HIGHLIGHT)),
  token("--accent-foreground", ref(HIGHLIGHT_FG), ref(HIGHLIGHT_FG)),
  token("--card", ref(SELECTION), ref(INPUT_BG)),
  token("--card-foreground", ref(FG), ref(FG)),
  token("--popover", ref(SELECTION), ref(INPUT_BG)),
  token("--popover-foreground", ref(FG), ref(FG)),
  token("--ring", ref(FG), ref(FG)),
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
  token("--success-subtle", mix(SUCCESS, 12), mix(SUCCESS, 12)),
  token("--success-text", ref(SUCCESS), "#0a6647"),
  token("--success-border", ref(SUCCESS), ref(SUCCESS)),
  token("--success-strong", ref(SUCCESS), ref(SUCCESS)),
  token("--success-strong-foreground", ref(BG), WHITE),
  token("--warning-subtle", mix(WARNING, 5), mix(WARNING, 8)),
  token("--warning-text", ref(WARNING), ref(WARNING)),
  token("--warning-border", ref(WARNING), ref(WARNING)),
  token("--warning-strong", ref(WARNING), ref(WARNING)),
  token("--warning-strong-foreground", ref(BG), WHITE),
  token("--error-subtle", mix(DANGER, 10), mix(DANGER, 10)),
  token("--error-text", ref(DANGER), "#b32424"),
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
  token("--neutral-text", ref(DIM), ref(DIM)),
  token("--neutral-strong", ref(DIM), ref(DIM)),
  token("--neutral-strong-foreground", ref(BG), WHITE),
] as const satisfies readonly ThemeDocsToken[];

export const THEME_DOCS_CODE_TOKENS = [
  token("--code-comment", ref(DIM), ref(DIM)),
  token("--code-string", ref(ACCENT), ref(MUTED)),
  token("--code-number", ref(ACCENT), ref(MUTED)),
  token("--code-keyword", ref(INFO), ref(INFO)),
  token("--code-function", ref(SUCCESS), ref(FG)),
  token("--code-tag", ref(SUCCESS), ref(FG)),
  token("--code-attr", ref(INFO), ref(INFO)),
  token("--code-parameter", ref(WARNING), ref(WARNING)),
  token("--code-operator", ref(DANGER), ref(DANGER)),
  token("--code-variable", ref(FG), ref(FG)),
  token("--code-type", ref(INFO), ref(INFO)),
] as const satisfies readonly ThemeDocsToken[];

export const THEME_DOCS_SURFACE_TOKENS = [
  token("--surface-1", "#111111", "#eef0f3"),
  token("--surface-1-highlight", mix(FG, 12), WHITE),
  token("--surface-2", "#181818", "#e7eaee"),
] as const satisfies readonly ThemeDocsToken[];
