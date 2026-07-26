import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DARK_PALETTE_VALUES,
  LIGHT_PALETTE_VALUES,
  THEME_TOKEN_KEYS,
  type ThemeTokenKey,
} from "@diffgazer/core/theme";
import { describe, expect, it } from "vitest";

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

function loadThemeOverridesCss(): string {
  return readFileSync(resolve(import.meta.dirname, "theme-overrides.css"), "utf8");
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
  it("does not declare overrides under :root, which would beat the lib light theme", () => {
    const css = loadThemeOverridesCss();
    // This file loads after @diffgazer/ui/styles.css, so a `:root` selector here
    // outranks the lib's [data-theme="light"] block and forces dark tokens in
    // light mode. Overrides must stay scoped to data-theme selectors.
    expect(css).not.toMatch(/(?:^|[\n,{])\s*:root\b/);
  });

  it.each([
    ["dark", { "--border-strong": "#484f58", "--surface-1": "#161b22" }],
    ["light", { "--border-strong": "#8c959f", "--surface-1": "#f6f8fa" }],
  ] as const)("restates the %s structural tokens so lib monochrome surfaces stay out of the app palette", (theme, expected) => {
    const css = loadThemeOverridesCss();
    const declarations = getDeclarations(getThemeBlock(css, String.raw`\[data-theme="${theme}"\]`));

    for (const [variable, value] of Object.entries(expected)) {
      expect(declarations.get(variable)).toBe(value);
    }
  });

  it.each([
    ["dark", DARK_PALETTE_VALUES],
    ["light", LIGHT_PALETTE_VALUES],
  ] as const)("keeps every %s theme value equal to the canonical core palette", (theme, expected) => {
    const css = loadThemeOverridesCss();
    const selector = String.raw`\[data-theme="${theme}"\]`;
    const block = getThemeBlock(css, selector);

    expect(getPaletteValues(block)).toEqual(expected);
  });

  it.each([
    "dark",
    "light",
  ] as const)("gives the %s app palette a sunken input well distinct from its canvas", (theme) => {
    const css = loadThemeOverridesCss();
    const declarations = getDeclarations(getThemeBlock(css, String.raw`\[data-theme="${theme}"\]`));

    expect(resolveDeclaration(declarations, "--input-well")).not.toBe(
      resolveDeclaration(declarations, "--base-bg"),
    );
  });

  it.each([
    "dark",
    "light",
  ] as const)("lets the increased-contrast preference override the %s app palette", (theme) => {
    const css = loadThemeOverridesCss();
    const contrastStart = css.indexOf("@media (prefers-contrast: more)");
    const selector = String.raw`\[data-theme="${theme}"\]`;
    const base = getDeclarations(getThemeBlock(css, selector));
    const contrast = getDeclarations(getThemeBlock(css.slice(contrastStart), selector));

    expect(contrastStart).toBeGreaterThan(css.indexOf(`[data-theme="${theme}"]`));
    expect(contrast.size).toBeGreaterThan(0);
    for (const [variable, value] of contrast) {
      // Every contrast declaration must restate a base primitive with a
      // different value, or the preference changes nothing.
      expect(base.has(variable)).toBe(true);
      expect(value).not.toBe(base.get(variable));
    }
  });
});
