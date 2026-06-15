import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRIMITIVE_TOKEN_KEYS,
  type PrimitiveTokenKey,
  SEMANTIC_TOKEN_KEYS,
} from "@diffgazer/core/theme";
import { describe, expect, it } from "vitest";
import {
  orderThemeDocsPrimitives,
  THEME_DOCS_COLOR_GRID_ORDER,
  THEME_DOCS_PRIMITIVES,
  THEME_DOCS_SEMANTIC_TOKENS,
  THEME_DOCS_TOKENS,
} from "./index";

const THEME_CSS_PATH = resolve(fileURLToPath(import.meta.url), "../../styles/theme.css");

const DARK_BLOCK_RE = /:root,\s*\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/;
const LIGHT_BLOCK_RE = /\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/;
const DECLARATION_RE = /^\s*(--[a-z0-9-]+):\s*([^;]+);/gm;
const NON_COLOR_TOKENS = new Set(["--base-font-mono", "--trans-fast", "--radius", "--scrim"]);

/** Core theme-token keys map to product-neutral `--base-*` primitive names. */
const PRIMITIVE_KEY_TO_BASE: Record<PrimitiveTokenKey, `--base-${string}`> = {
  bg: "--base-bg",
  fg: "--base-fg",
  blue: "--base-info",
  violet: "--base-accent",
  green: "--base-success",
  red: "--base-danger",
  yellow: "--base-warning",
  border: "--base-border",
  muted: "--base-muted",
};

function extractDeclarations(blockPattern: RegExp): Map<string, string> {
  const source = readFileSync(THEME_CSS_PATH, "utf8");
  const block = source.match(blockPattern)?.[1];

  if (!block) {
    throw new Error(`Missing theme.css block for ${blockPattern}`);
  }

  const declarations = new Map<string, string>();
  for (const match of block.matchAll(DECLARATION_RE)) {
    const name = match[1];
    const value = match[2];
    if (!name || !value) {
      continue;
    }
    declarations.set(name, value.trim());
  }

  return declarations;
}

const darkDeclarations = extractDeclarations(DARK_BLOCK_RE);
const lightDeclarations = extractDeclarations(LIGHT_BLOCK_RE);

/**
 * Diagram edges: semantic ROLE rows whose value is `var(--base-x)`, grouped by
 * the primitive. On-solid pairs (`--<role>-foreground`) belong to their tone, not
 * to the primitive they happen to equal, so they are excluded — `--foreground`
 * (no role prefix) and the bare role tokens stay.
 */
const PAIRED_FOREGROUND_RE = /^--.+-foreground$/;

function edgesByPrimitive(declarations: Map<string, string>): Map<string, string[]> {
  const edges = new Map<string, string[]>();
  for (const token of THEME_DOCS_SEMANTIC_TOKENS) {
    if (PAIRED_FOREGROUND_RE.test(token.name)) {
      continue;
    }
    const value = declarations.get(token.name);
    const primitive = value?.match(/^var\((--base-[a-z0-9-]+)\)$/)?.[1];
    if (!primitive) {
      continue;
    }
    const list = edges.get(primitive) ?? [];
    list.push(token.name);
    edges.set(primitive, list);
  }
  return edges;
}

const darkEdges = edgesByPrimitive(darkDeclarations);
const lightEdges = edgesByPrimitive(lightDeclarations);

describe("THEME_DOCS_TOKENS", () => {
  it("documents every theme color token declared by @diffgazer/ui", () => {
    const documentedNames = THEME_DOCS_TOKENS.map((token) => token.name).sort();
    const themeCssNames = [...darkDeclarations.keys()]
      .filter((name) => !NON_COLOR_TOKENS.has(name))
      .sort();

    expect(new Set(documentedNames).size).toBe(THEME_DOCS_TOKENS.length);
    expect(documentedNames).toEqual(themeCssNames);
  });

  it("matches the dark and light theme.css assignments", () => {
    for (const token of THEME_DOCS_TOKENS) {
      expect(token.darkValue).toBe(darkDeclarations.get(token.name));
      expect(token.lightValue).toBe(lightDeclarations.get(token.name));
    }
  });

  it("covers the core primitive and semantic tokens that the UI theme exposes", () => {
    const primitiveNames = new Set<string>(THEME_DOCS_PRIMITIVES.map((token) => token.name));
    for (const key of PRIMITIVE_TOKEN_KEYS) {
      expect(primitiveNames.has(PRIMITIVE_KEY_TO_BASE[key])).toBe(true);
    }

    const semanticNames = new Set<string>(THEME_DOCS_SEMANTIC_TOKENS.map((token) => token.name));
    for (const key of SEMANTIC_TOKEN_KEYS) {
      // `accent` resolves to the `--accent` semantic role; the rest match 1:1.
      const semanticName = key === "accent" ? "--accent" : `--${key}`;
      expect(semanticNames.has(semanticName)).toBe(true);
    }
  });
});

describe("primitive semanticTokens edges match parsed theme.css", () => {
  it("lists exactly the semantic rows that map to each primitive per theme", () => {
    for (const primitive of THEME_DOCS_PRIMITIVES) {
      const expectedDark = (darkEdges.get(primitive.name) ?? []).slice().sort();
      const expectedLight = (lightEdges.get(primitive.name) ?? []).slice().sort();

      expect([...primitive.semanticTokens.dark].sort()).toEqual(expectedDark);
      expect([...primitive.semanticTokens.light].sort()).toEqual(expectedLight);
    }
  });
});

describe("orderThemeDocsPrimitives", () => {
  it("rejects an order array with a name that is not a primitive", () => {
    expect(() =>
      orderThemeDocsPrimitives([
        // @ts-expect-error -- a typo'd primitive name is now a compile error, not a runtime throw.
        "--base-typo",
        ...THEME_DOCS_COLOR_GRID_ORDER.slice(1),
      ]),
    ).toThrow(/missing primitives/);
  });
});
