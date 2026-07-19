import {
  DARK_PALETTE_VALUES,
  LIGHT_PALETTE_VALUES,
  THEME_TOKEN_KEYS,
  type ThemeTokenKey,
} from "@diffgazer/core/theme";
import { describe, expect, it } from "vitest";

declare const process: { cwd(): string };

const TOKEN_CSS_VARIABLES = {
  bg: "--base-bg",
  fg: "--base-fg",
  blue: "--base-info",
  violet: "--base-accent",
  green: "--base-success",
  red: "--base-danger",
  yellow: "--base-warning",
  border: "--base-border",
  muted: "--base-muted",
  success: "--base-success",
  warning: "--base-warning",
  error: "--base-danger",
  info: "--base-info",
  accent: "--base-accent",
  severityBlocker: "--severity-blocker",
  severityHigh: "--severity-high",
  severityMedium: "--severity-medium",
  severityLow: "--severity-low",
  severityNit: "--severity-nit",
  statusRunning: "--status-running",
  statusComplete: "--status-complete",
  statusPending: "--status-pending",
} as const satisfies Record<ThemeTokenKey, `--${string}`>;

const CONTRAST_VALUES = {
  dark: {
    "--base-border": "#777777",
    "--base-muted": "#999999",
    "--base-accent": "#b3b3b3",
  },
  light: {
    "--base-border": "#6e6e6e",
    "--base-muted": "#555555",
  },
} as const;

async function loadThemeOverridesCss(): Promise<string> {
  const fsSpecifier = "node:fs";
  const pathSpecifier = "node:path";
  const [{ readFileSync }, { join }] = await Promise.all([
    import(fsSpecifier),
    import(pathSpecifier),
  ]);

  return readFileSync(join(process.cwd(), "src/styles/theme-overrides.css"), "utf8");
}

function getThemeBlock(css: string, selector: string): string {
  const pattern = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`);
  const match = css.match(pattern);
  if (!match?.[1]) {
    throw new Error(`Missing ${selector} block in ${css.slice(0, 120)}`);
  }
  return match[1];
}

function getDeclarations(block: string): Map<string, string> {
  const declarations = new Map<string, string>();
  for (const match of block.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)) {
    if (match[1] && match[2]) declarations.set(match[1], match[2].trim());
  }
  return declarations;
}

function resolveDeclaration(declarations: Map<string, string>, variable: string): string {
  const value = declarations.get(variable);
  if (!value) throw new Error(`Missing ${variable} declaration`);

  const reference = value.match(/^var\((--[\w-]+)\)$/)?.[1];
  return reference ? resolveDeclaration(declarations, reference) : value;
}

function getPaletteValues(block: string): Record<string, string> {
  const declarations = getDeclarations(block);
  return Object.fromEntries(
    THEME_TOKEN_KEYS.map((token) => [
      token,
      resolveDeclaration(declarations, TOKEN_CSS_VARIABLES[token]),
    ]),
  );
}

describe("theme override domain token parity", () => {
  it("does not declare overrides under :root, which would beat the lib light theme", async () => {
    const css = await loadThemeOverridesCss();
    // This file loads after @diffgazer/ui/styles.css, so a `:root` selector here
    // outranks the lib's [data-theme="light"] block and forces dark tokens in
    // light mode. Overrides must stay scoped to data-theme selectors.
    expect(css).not.toMatch(/(?:^|[\n,{])\s*:root\b/);
  });

  it.each([
    ["dark", DARK_PALETTE_VALUES],
    ["light", LIGHT_PALETTE_VALUES],
  ] as const)("keeps every %s theme value equal to the canonical core palette", async (theme, expected) => {
    const css = await loadThemeOverridesCss();
    const selector = String.raw`\[data-theme="${theme}"\]`;
    const block = getThemeBlock(css, selector);

    expect(getPaletteValues(block)).toEqual(expected);
  });

  it.each([
    "dark",
    "light",
  ] as const)("lets the increased-contrast preference override the %s app palette", async (theme) => {
    const css = await loadThemeOverridesCss();
    const contrastStart = css.indexOf("@media (prefers-contrast: more)");
    const baseBlock = getThemeBlock(css, String.raw`\[data-theme="${theme}"\]`);
    const contrastBlock = getThemeBlock(
      css.slice(contrastStart),
      String.raw`\[data-theme="${theme}"\]`,
    );
    const cascade = new Map([...getDeclarations(baseBlock), ...getDeclarations(contrastBlock)]);

    expect(contrastStart).toBeGreaterThan(css.indexOf(`[data-theme="${theme}"]`));
    for (const [variable, value] of Object.entries(CONTRAST_VALUES[theme])) {
      expect(cascade.get(variable)).toBe(value);
    }
  });
});
